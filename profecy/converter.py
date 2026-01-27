"""Subprocess pipeline: gprof2dot -> dot -> SVG."""

import logging
import shlex
import subprocess
from pathlib import Path

from .config import load_settings

logger = logging.getLogger(__name__)

TIMEOUT_SECONDS = 60


def generate_svg(file_path: str, options: dict, settings: dict | None = None) -> tuple[str, str]:
    """Run gprof2dot piped into dot to produce SVG.

    Returns (svg_string, error_string). On success error_string is empty.
    On failure svg_string is empty and error_string describes the problem.
    """
    if settings is None:
        settings = load_settings()

    path = Path(file_path)
    if not path.exists():
        logger.warning("File not found: %s", file_path)
        return "", f"File not found: {file_path}"

    gprof2dot_cmd = _build_gprof2dot_command(file_path, options, settings)
    dot_cmd = _build_dot_command(settings)

    logger.info("Running: %s | %s", gprof2dot_cmd, dot_cmd)

    try:
        gprof2dot_proc = subprocess.Popen(
            gprof2dot_cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            shell=True,
        )
        dot_proc = subprocess.Popen(
            dot_cmd,
            stdin=gprof2dot_proc.stdout,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            shell=True,
        )
        # Allow gprof2dot to receive SIGPIPE if dot exits early
        gprof2dot_proc.stdout.close()

        dot_stdout, dot_stderr = dot_proc.communicate(timeout=TIMEOUT_SECONDS)

        # Also collect gprof2dot stderr
        gprof2dot_proc.wait(timeout=5)
        gprof2dot_stderr = gprof2dot_proc.stderr.read()

        errors = []
        if gprof2dot_proc.returncode != 0:
            msg = gprof2dot_stderr.decode("utf-8", errors="replace").strip()
            errors.append(f"gprof2dot error (exit {gprof2dot_proc.returncode}): {msg}")
        if dot_proc.returncode != 0:
            msg = dot_stderr.decode("utf-8", errors="replace").strip()
            errors.append(f"dot error (exit {dot_proc.returncode}): {msg}")

        if errors:
            error_str = "\n".join(errors)
            logger.error("Pipeline failed: %s", error_str)
            return "", error_str

        svg = dot_stdout.decode("utf-8", errors="replace")
        if not svg.strip():
            logger.warning("Pipeline produced empty SVG for %s", file_path)
            return "", "No SVG output produced. Check that your profile file and format are correct."

        logger.info("Generated SVG (%d bytes) for %s", len(svg), file_path)
        return svg, ""

    except subprocess.TimeoutExpired:
        gprof2dot_proc.kill()
        dot_proc.kill()
        logger.error("Pipeline timed out after %ds for %s", TIMEOUT_SECONDS, file_path)
        return "", f"Pipeline timed out after {TIMEOUT_SECONDS} seconds."
    except FileNotFoundError as e:
        logger.error("Command not found: %s", e)
        return "", f"Command not found: {e}"
    except OSError as e:
        logger.error("OS error running pipeline: %s", e)
        return "", f"Failed to run pipeline: {e}"


def _build_gprof2dot_command(file_path: str, options: dict, settings: dict) -> str:
    """Build the gprof2dot command string."""
    cmd = settings.get("gprof2dot_command", "uvx gprof2dot")

    parts = [cmd]

    fmt = options.get("format", "prof")
    parts.append(f"-f {shlex.quote(fmt)}")

    node_thres = options.get("node_threshold")
    if node_thres is not None:
        parts.append(f"-n {float(node_thres)}")

    edge_thres = options.get("edge_threshold")
    if edge_thres is not None:
        parts.append(f"-e {float(edge_thres)}")

    colormap = options.get("colormap")
    if colormap:
        parts.append(f"-c {shlex.quote(colormap)}")

    if options.get("strip"):
        parts.append("-s")

    if options.get("wrap"):
        parts.append("-w")

    if options.get("color_nodes_by_selftime"):
        parts.append("--color-nodes-by-selftime")

    if options.get("show_samples"):
        parts.append("--show-samples")

    # Advanced options
    root = options.get("root")
    if root:
        parts.append(f"-z {shlex.quote(root)}")

    leaf = options.get("leaf")
    if leaf:
        parts.append(f"-l {shlex.quote(leaf)}")

    depth = options.get("depth")
    if depth:
        parts.append(f"--depth={int(depth)}")

    skew = options.get("skew")
    if skew:
        parts.append(f"--skew={float(skew)}")

    path_filter = options.get("path")
    if path_filter:
        parts.append(f"-p {shlex.quote(path_filter)}")

    parts.append(shlex.quote(file_path))

    return " ".join(parts)


def _build_dot_command(settings: dict) -> str:
    """Build the dot command string."""
    cmd = settings.get("dot_command", "dot")
    return f"{cmd} -Tsvg"
