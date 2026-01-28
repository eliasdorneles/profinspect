"""Flask application factory and routes."""

import logging
import os
import tempfile

from flask import Flask, jsonify, render_template, request

from .config import get_defaults, load_settings, save_settings
from .converter import generate_svg, infer_format

logger = logging.getLogger(__name__)

FORMATS = [
    "prof",
    "pstats",
    "callgrind",
    "perf",
    "collapse",
    "axe",
    "dtrace",
    "hprof",
    "json",
    "sleepy",
    "sysprof",
    "xperf",
]

COLORMAPS = ["color", "bw", "gray", "pink", "print"]


def create_app(initial_file: str | None = None) -> Flask:
    """Create and configure the Flask application."""
    app = Flask(__name__)
    app.config["INITIAL_FILE"] = initial_file or ""

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )

    @app.template_filter("basename")
    def basename_filter(path):
        return os.path.basename(path) if path else ""

    @app.route("/")
    def index():
        defaults = get_defaults()
        return render_template(
            "index.html",
            initial_file=app.config["INITIAL_FILE"],
            defaults=defaults,
            formats=FORMATS,
            colormaps=COLORMAPS,
        )

    @app.route("/generate", methods=["POST"])
    def generate():
        # Support both FormData (file upload) and JSON (file_path)
        uploaded_file = request.files.get("file")
        file_path = request.form.get("file_path", "") if uploaded_file or request.form else (request.get_json() or {}).get("file_path", "")

        if not uploaded_file and not file_path:
            return jsonify({"svg": "", "error": "No file provided."}), 400

        # Read options from form fields or JSON
        if request.form:
            data = request.form
        else:
            data = request.get_json() or {}

        def _bool(val):
            if isinstance(val, bool):
                return val
            return val in ("true", "True", "1", "on")

        filename = uploaded_file.filename if uploaded_file else os.path.basename(file_path)
        fmt = data.get("format", "auto")
        if fmt == "auto":
            inferred = infer_format(filename)
            if inferred:
                fmt = inferred
                logger.info("Auto-detected format '%s' for %s", fmt, filename)
            else:
                fmt = "prof"
                logger.info("Could not infer format for %s, falling back to '%s'", filename, fmt)

        options = {
            "format": fmt,
            "node_threshold": float(data.get("node_threshold", 0.5)),
            "edge_threshold": float(data.get("edge_threshold", 0.1)),
            "colormap": data.get("colormap", "color"),
            "strip": _bool(data.get("strip", False)),
            "wrap": _bool(data.get("wrap", False)),
            "color_nodes_by_selftime": _bool(data.get("color_nodes_by_selftime", False)),
            "show_samples": _bool(data.get("show_samples", False)),
            "root": data.get("root", ""),
            "leaf": data.get("leaf", ""),
            "depth": data.get("depth", ""),
            "skew": data.get("skew", ""),
            "path": data.get("path", ""),
        }

        settings = load_settings()
        tmp_path = None
        try:
            if uploaded_file:
                # Save uploaded file to a temp location
                suffix = os.path.splitext(filename)[1] or ""
                fd, tmp_path = tempfile.mkstemp(suffix=suffix, prefix="profinspect_")
                os.close(fd)
                uploaded_file.save(tmp_path)
                target_path = tmp_path
                logger.info("Saved uploaded file %s to %s", filename, tmp_path)
            else:
                target_path = file_path

            svg, error = generate_svg(target_path, options, settings)
        finally:
            if tmp_path and os.path.exists(tmp_path):
                os.unlink(tmp_path)

        if error:
            logger.error("Generate failed for %s: %s", filename, error)
            return jsonify({"svg": "", "error": error}), 422

        logger.info("Generated SVG for %s", filename)
        return jsonify({"svg": svg, "error": ""})

    @app.route("/settings")
    def settings_page():
        settings = load_settings()
        return render_template("settings.html", settings=settings, formats=FORMATS, colormaps=COLORMAPS)

    @app.route("/settings", methods=["POST"])
    def save_settings_route():
        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided."}), 400

        new_settings = {
            "gprof2dot_command": data.get("gprof2dot_command", "gprof2dot"),
            "dot_command": data.get("dot_command", "dot"),
            "defaults": {
                "node_threshold": float(data.get("default_node_threshold", 0.5)),
                "edge_threshold": float(data.get("default_edge_threshold", 0.1)),
                "colormap": data.get("default_colormap", "color"),
                "strip": bool(data.get("default_strip", False)),
                "wrap": bool(data.get("default_wrap", False)),
                "color_nodes_by_selftime": bool(data.get("default_color_nodes_by_selftime", False)),
                "show_samples": bool(data.get("default_show_samples", False)),
            },
        }

        save_settings(new_settings)
        return jsonify({"success": True})

    return app
