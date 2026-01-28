"""Settings management for Profinspect."""

import json
from pathlib import Path

CONFIG_DIR = Path.home() / ".config" / "profinspect"
CONFIG_FILE = CONFIG_DIR / "settings.json"

DEFAULT_SETTINGS = {
    "gprof2dot_command": "gprof2dot",
    "dot_command": "dot",
    "defaults": {
        "node_threshold": 0.5,
        "edge_threshold": 0.1,
        "colormap": "color",
        "strip": False,
        "wrap": False,
        "color_nodes_by_selftime": False,
        "show_samples": False,
    },
}


def load_settings() -> dict:
    """Load settings from disk, falling back to defaults."""
    if CONFIG_FILE.exists():
        try:
            with open(CONFIG_FILE) as f:
                saved = json.load(f)
            # Merge with defaults so new keys are always present
            merged = {**DEFAULT_SETTINGS, **saved}
            merged["defaults"] = {**DEFAULT_SETTINGS["defaults"], **saved.get("defaults", {})}
            return merged
        except (json.JSONDecodeError, OSError):
            return dict(DEFAULT_SETTINGS)
    return dict(DEFAULT_SETTINGS)


def save_settings(data: dict) -> None:
    """Save settings to disk."""
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    with open(CONFIG_FILE, "w") as f:
        json.dump(data, f, indent=2)


def get_defaults() -> dict:
    """Return the default option values from current settings."""
    return load_settings()["defaults"]
