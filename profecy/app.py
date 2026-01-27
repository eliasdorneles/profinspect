"""Flask application factory and routes."""

import logging

from flask import Flask, jsonify, render_template, request

from .config import get_defaults, load_settings, save_settings
from .converter import generate_svg

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
        data = request.get_json()
        if not data or not data.get("file_path"):
            return jsonify({"svg": "", "error": "No file path provided."}), 400

        options = {
            "format": data.get("format", "prof"),
            "node_threshold": data.get("node_threshold", 0.5),
            "edge_threshold": data.get("edge_threshold", 0.1),
            "colormap": data.get("colormap", "color"),
            "strip": data.get("strip", False),
            "wrap": data.get("wrap", False),
            "color_nodes_by_selftime": data.get("color_nodes_by_selftime", False),
            "show_samples": data.get("show_samples", False),
            "root": data.get("root", ""),
            "leaf": data.get("leaf", ""),
            "depth": data.get("depth", ""),
            "skew": data.get("skew", ""),
            "path": data.get("path", ""),
        }

        settings = load_settings()
        svg, error = generate_svg(data["file_path"], options, settings)

        if error:
            logger.error("Generate failed for %s: %s", data["file_path"], error)
            return jsonify({"svg": "", "error": error}), 422

        logger.info("Generated SVG for %s", data["file_path"])
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
            "gprof2dot_command": data.get("gprof2dot_command", "uvx gprof2dot"),
            "dot_command": data.get("dot_command", "dot"),
            "defaults": {
                "format": data.get("default_format", "prof"),
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
