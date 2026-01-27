(function () {
    "use strict";

    // --- DOM refs ---
    const generateBtn = document.getElementById("generate-btn");
    const statusBar = document.getElementById("status-bar");
    const svgContainer = document.getElementById("svg-container");
    const svgWrapper = document.getElementById("svg-wrapper");
    const placeholder = document.getElementById("placeholder");
    const sidebarToggle = document.getElementById("sidebar-toggle");
    const sidebar = document.getElementById("sidebar");
    const nodeThreshold = document.getElementById("node_threshold");
    const edgeThreshold = document.getElementById("edge_threshold");
    const nodeThresholdVal = document.getElementById("node_threshold_val");
    const edgeThresholdVal = document.getElementById("edge_threshold_val");

    // --- Pan/Zoom state ---
    let scale = 1;
    let translateX = 0;
    let translateY = 0;
    let isPanning = false;
    let panStartX = 0;
    let panStartY = 0;
    let panStartTranslateX = 0;
    let panStartTranslateY = 0;

    const MIN_SCALE = 0.05;
    const MAX_SCALE = 10;
    const ZOOM_FACTOR = 1.15;

    function applyTransform() {
        svgWrapper.style.transform =
            "translate(" + translateX + "px, " + translateY + "px) scale(" + scale + ")";
    }

    // --- Zoom controls ---
    document.getElementById("zoom-in").addEventListener("click", function () {
        const rect = svgContainer.getBoundingClientRect();
        zoomAtPoint(rect.width / 2, rect.height / 2, ZOOM_FACTOR);
    });

    document.getElementById("zoom-out").addEventListener("click", function () {
        const rect = svgContainer.getBoundingClientRect();
        zoomAtPoint(rect.width / 2, rect.height / 2, 1 / ZOOM_FACTOR);
    });

    document.getElementById("zoom-reset").addEventListener("click", function () {
        scale = 1;
        translateX = 0;
        translateY = 0;
        applyTransform();
    });

    document.getElementById("zoom-fit").addEventListener("click", fitToView);

    function zoomAtPoint(cx, cy, factor) {
        var newScale = scale * factor;
        if (newScale < MIN_SCALE) newScale = MIN_SCALE;
        if (newScale > MAX_SCALE) newScale = MAX_SCALE;
        var ratio = newScale / scale;
        translateX = cx - ratio * (cx - translateX);
        translateY = cy - ratio * (cy - translateY);
        scale = newScale;
        applyTransform();
    }

    function fitToView() {
        var svg = svgWrapper.querySelector("svg");
        if (!svg) return;
        var containerRect = svgContainer.getBoundingClientRect();
        var svgWidth = svg.getBoundingClientRect().width / scale;
        var svgHeight = svg.getBoundingClientRect().height / scale;
        if (svgWidth === 0 || svgHeight === 0) return;
        var scaleX = containerRect.width / svgWidth;
        var scaleY = containerRect.height / svgHeight;
        scale = Math.min(scaleX, scaleY) * 0.95; // 5% margin
        translateX = (containerRect.width - svgWidth * scale) / 2;
        translateY = (containerRect.height - svgHeight * scale) / 2;
        applyTransform();
    }

    // --- Wheel zoom ---
    svgContainer.addEventListener("wheel", function (e) {
        e.preventDefault();
        var rect = svgContainer.getBoundingClientRect();
        var cx = e.clientX - rect.left;
        var cy = e.clientY - rect.top;
        var factor = e.deltaY < 0 ? ZOOM_FACTOR : 1 / ZOOM_FACTOR;
        zoomAtPoint(cx, cy, factor);
    }, { passive: false });

    // --- Pan (pointer events) ---
    svgContainer.addEventListener("pointerdown", function (e) {
        if (e.button !== 0) return;
        isPanning = true;
        panStartX = e.clientX;
        panStartY = e.clientY;
        panStartTranslateX = translateX;
        panStartTranslateY = translateY;
        svgContainer.classList.add("grabbing");
        svgContainer.setPointerCapture(e.pointerId);
    });

    svgContainer.addEventListener("pointermove", function (e) {
        if (!isPanning) return;
        translateX = panStartTranslateX + (e.clientX - panStartX);
        translateY = panStartTranslateY + (e.clientY - panStartY);
        applyTransform();
    });

    svgContainer.addEventListener("pointerup", function (e) {
        isPanning = false;
        svgContainer.classList.remove("grabbing");
    });

    svgContainer.addEventListener("pointercancel", function () {
        isPanning = false;
        svgContainer.classList.remove("grabbing");
    });

    // --- Sidebar toggle ---
    sidebarToggle.addEventListener("click", function () {
        sidebar.classList.toggle("collapsed");
        sidebarToggle.textContent = sidebar.classList.contains("collapsed") ? "\u203A" : "\u2039";
    });

    // --- Slider display ---
    nodeThreshold.addEventListener("input", function () {
        nodeThresholdVal.textContent = this.value + "%";
    });

    edgeThreshold.addEventListener("input", function () {
        edgeThresholdVal.textContent = this.value + "%";
    });

    // --- Status bar helpers ---
    function setStatus(msg, type) {
        statusBar.textContent = msg;
        statusBar.className = "status-bar" + (type ? " " + type : "");
    }

    // --- Generate ---
    function gatherOptions() {
        return {
            file_path: document.getElementById("file_path").value.trim(),
            format: document.getElementById("format").value,
            node_threshold: parseFloat(nodeThreshold.value),
            edge_threshold: parseFloat(edgeThreshold.value),
            colormap: document.getElementById("colormap").value,
            strip: document.getElementById("strip").checked,
            wrap: document.getElementById("wrap").checked,
            color_nodes_by_selftime: document.getElementById("color_nodes_by_selftime").checked,
            show_samples: document.getElementById("show_samples").checked,
            root: document.getElementById("root").value.trim(),
            leaf: document.getElementById("leaf").value.trim(),
            depth: document.getElementById("depth").value.trim(),
            skew: document.getElementById("skew").value.trim(),
            path: document.getElementById("path_filter").value.trim(),
        };
    }

    async function doGenerate() {
        var opts = gatherOptions();
        if (!opts.file_path) {
            setStatus("Please enter a file path.", "error");
            return;
        }

        setStatus("Generating...", "");
        generateBtn.disabled = true;
        generateBtn.textContent = "Generating...";

        try {
            var resp = await fetch("/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(opts),
            });

            if (!resp.ok) {
                var errData;
                try {
                    errData = await resp.json();
                } catch (_) {
                    setStatus("Server error (" + resp.status + ")", "error");
                    return;
                }
                setStatus(errData.error || "Server error (" + resp.status + ")", "error");
                return;
            }

            var data = await resp.json();

            if (data.error) {
                setStatus(data.error, "error");
                return;
            }

            // Insert SVG
            if (placeholder) placeholder.style.display = "none";
            // Remove any existing SVG
            var existing = svgWrapper.querySelector("svg");
            if (existing) existing.remove();

            var parser = new DOMParser();
            var doc = parser.parseFromString(data.svg, "image/svg+xml");
            var parseError = doc.querySelector("parsererror");
            if (parseError) {
                setStatus("Failed to parse SVG: " + parseError.textContent, "error");
                return;
            }
            var svg = doc.documentElement;
            if (svg && svg.nodeName === "svg") {
                // Adopt the SVG node into this document so it can be appended
                svg = document.adoptNode(svg);
                svgWrapper.appendChild(svg);
                // Reset transform and fit
                scale = 1;
                translateX = 0;
                translateY = 0;
                applyTransform();
                // Give the browser a tick to layout, then fit
                requestAnimationFrame(function () {
                    fitToView();
                });
                setStatus("Ready", "success");
            } else {
                setStatus("No SVG in response.", "error");
            }
        } catch (e) {
            setStatus("Request failed: " + e.message, "error");
        } finally {
            generateBtn.disabled = false;
            generateBtn.textContent = "Generate";
        }
    }

    generateBtn.addEventListener("click", doGenerate);

    // --- Keyboard shortcut: Enter to generate ---
    document.addEventListener("keydown", function (e) {
        if (e.key === "Enter" && e.ctrlKey) {
            doGenerate();
        }
    });

    // --- Auto-generate if initial file provided ---
    if (window.PROFECY_INITIAL_FILE) {
        doGenerate();
    }
})();
