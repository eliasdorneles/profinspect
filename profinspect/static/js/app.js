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
    const fileInput = document.getElementById("file_input");
    const fileBrowseBtn = document.getElementById("file-browse-btn");
    const fileNameSpan = document.getElementById("file-name");
    const filePathInput = document.getElementById("file_path");
    const formatSelect = document.getElementById("format");

    // The File object selected by the user (null when using CLI-provided path)
    var selectedFile = null;

    // --- Auto-update ---
    var autoUpdateCheckbox = document.getElementById("auto_update");
    var autoUpdateTimer = null;
    var DEBOUNCE_MS = 400;

    function isAutoUpdate() {
        return autoUpdateCheckbox.checked;
    }

    function applyAutoUpdateUI() {
        generateBtn.style.display = isAutoUpdate() ? "none" : "";
        try { localStorage.setItem("profinspect_auto_update", isAutoUpdate() ? "1" : "0"); } catch (_) {}
    }

    // Restore preference from localStorage
    (function () {
        try {
            var saved = localStorage.getItem("profinspect_auto_update");
            if (saved === "0") autoUpdateCheckbox.checked = false;
        } catch (_) {}
        applyAutoUpdateUI();
    })();

    autoUpdateCheckbox.addEventListener("change", function () {
        applyAutoUpdateUI();
        scheduleGenerate();
    });

    function scheduleGenerate() {
        if (!isAutoUpdate()) return;
        if (!hasFile()) return;
        if (isGenerating) {
            pendingGenerate = true;
            return;
        }
        clearTimeout(autoUpdateTimer);
        autoUpdateTimer = setTimeout(doGenerate, DEBOUNCE_MS);
    }

    // --- Format inference ---
    var FORMAT_EXTENSIONS = {
        ".pstats": "pstats",
        ".prof": "prof",
        ".hprof": "hprof",
        ".json": "json",
        ".collapse": "collapse",
        ".dtrace": "dtrace",
        ".perf": "perf",
        ".callgrind": "callgrind",
    };

    var FORMAT_PREFIXES = {
        "callgrind.out": "callgrind",
    };

    function inferFormat(filename) {
        var name = filename.toLowerCase();
        var keys, i;
        keys = Object.keys(FORMAT_PREFIXES);
        for (i = 0; i < keys.length; i++) {
            if (name.startsWith(keys[i])) return FORMAT_PREFIXES[keys[i]];
        }
        keys = Object.keys(FORMAT_EXTENSIONS);
        for (i = 0; i < keys.length; i++) {
            if (name.endsWith(keys[i])) return FORMAT_EXTENSIONS[keys[i]];
        }
        return null;
    }

    // --- File picker ---
    fileBrowseBtn.addEventListener("click", function () {
        fileInput.click();
    });

    fileInput.addEventListener("change", function () {
        if (fileInput.files.length > 0) {
            selectedFile = fileInput.files[0];
            fileNameSpan.textContent = selectedFile.name;
            fileNameSpan.title = selectedFile.name;
            // Clear any CLI-provided path since user chose a new file
            filePathInput.value = "";

            // Auto-detect format if dropdown is on auto
            if (formatSelect.value === "auto") {
                var inferred = inferFormat(selectedFile.name);
                if (inferred) {
                    setStatus("Detected format: " + inferred, "success");
                }
            }
            scheduleGenerate();
        }
    });

    // --- Pan/Zoom state ---
    var scale = 1;
    var translateX = 0;
    var translateY = 0;
    var isPanning = false;
    var panStartX = 0;
    var panStartY = 0;
    var panStartTranslateX = 0;
    var panStartTranslateY = 0;

    var MIN_SCALE = 0.05;
    var MAX_SCALE = 10;
    var ZOOM_FACTOR = 1.15;

    function applyTransform() {
        svgWrapper.style.transform =
            "translate(" + translateX + "px, " + translateY + "px) scale(" + scale + ")";
    }

    // --- Zoom controls ---
    document.getElementById("zoom-in").addEventListener("click", function () {
        var rect = svgContainer.getBoundingClientRect();
        zoomAtPoint(rect.width / 2, rect.height / 2, ZOOM_FACTOR);
    });

    document.getElementById("zoom-out").addEventListener("click", function () {
        var rect = svgContainer.getBoundingClientRect();
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
        scale = Math.min(scaleX, scaleY) * 0.95;
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
    // Allow text selection on SVG text elements; pan on everything else.
    function isTextTarget(el) {
        while (el && el !== svgContainer) {
            var tag = el.tagName;
            if (tag === "text" || tag === "tspan") return true;
            el = el.parentElement;
        }
        return false;
    }

    svgContainer.addEventListener("pointerdown", function (e) {
        if (e.button !== 0) return;
        // Don't pan when clicking on SVG text — let the browser handle selection
        if (isTextTarget(e.target)) return;
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

    svgContainer.addEventListener("pointerup", function () {
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
        scheduleGenerate();
    });

    edgeThreshold.addEventListener("input", function () {
        edgeThresholdVal.textContent = this.value + "%";
        scheduleGenerate();
    });

    // --- Auto-update triggers on other controls ---
    formatSelect.addEventListener("change", scheduleGenerate);
    document.getElementById("colormap").addEventListener("change", scheduleGenerate);
    document.getElementById("strip").addEventListener("change", scheduleGenerate);
    document.getElementById("wrap").addEventListener("change", scheduleGenerate);
    document.getElementById("color_nodes_by_selftime").addEventListener("change", scheduleGenerate);
    document.getElementById("show_samples").addEventListener("change", scheduleGenerate);
    // Text/number inputs: trigger on change (blur) to avoid firing on every keystroke
    document.getElementById("root").addEventListener("change", scheduleGenerate);
    document.getElementById("leaf").addEventListener("change", scheduleGenerate);
    document.getElementById("depth").addEventListener("change", scheduleGenerate);
    document.getElementById("skew").addEventListener("change", scheduleGenerate);
    document.getElementById("path_filter").addEventListener("change", scheduleGenerate);

    // --- Status bar helpers ---
    function setStatus(msg, type) {
        statusBar.textContent = msg;
        statusBar.className = "status-bar" + (type ? " " + type : "");
    }

    // --- Generate ---
    var isGenerating = false;
    var pendingGenerate = false;

    function hasFile() {
        return selectedFile || filePathInput.value.trim();
    }

    function buildFormData() {
        var fd = new FormData();

        if (selectedFile) {
            fd.append("file", selectedFile);
        } else {
            fd.append("file_path", filePathInput.value.trim());
        }

        fd.append("format", formatSelect.value);
        fd.append("node_threshold", nodeThreshold.value);
        fd.append("edge_threshold", edgeThreshold.value);
        fd.append("colormap", document.getElementById("colormap").value);
        fd.append("strip", document.getElementById("strip").checked);
        fd.append("wrap", document.getElementById("wrap").checked);
        fd.append("color_nodes_by_selftime", document.getElementById("color_nodes_by_selftime").checked);
        fd.append("show_samples", document.getElementById("show_samples").checked);
        fd.append("root", document.getElementById("root").value.trim());
        fd.append("leaf", document.getElementById("leaf").value.trim());
        fd.append("depth", document.getElementById("depth").value.trim());
        fd.append("skew", document.getElementById("skew").value.trim());
        fd.append("path", document.getElementById("path_filter").value.trim());

        return fd;
    }

    async function doGenerate() {
        if (!hasFile()) {
            setStatus("Please select a profile file.", "error");
            return;
        }
        if (isGenerating) return;
        isGenerating = true;

        setStatus("Generating...", "");
        generateBtn.disabled = true;
        generateBtn.textContent = "Generating...";

        try {
            var resp = await fetch("/generate", {
                method: "POST",
                body: buildFormData(),
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
                svg = document.adoptNode(svg);
                svgWrapper.appendChild(svg);
                // Reset transform and fit
                scale = 1;
                translateX = 0;
                translateY = 0;
                applyTransform();
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
            isGenerating = false;
            generateBtn.disabled = false;
            generateBtn.textContent = "Generate";
            if (pendingGenerate) {
                pendingGenerate = false;
                scheduleGenerate();
            }
        }
    }

    generateBtn.addEventListener("click", doGenerate);

    // --- Keyboard shortcut: Ctrl+Enter to generate ---
    document.addEventListener("keydown", function (e) {
        if (e.key === "Enter" && e.ctrlKey) {
            doGenerate();
        }
    });

    // --- Auto-generate if initial file provided via CLI ---
    if (window.PROFECY_INITIAL_FILE) {
        doGenerate();
    }
})();
