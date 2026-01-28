# Profinspect

A local web app for visualizing profiling data. Wraps [gprof2dot](https://github.com/jrfonseca/gprof2dot) and Graphviz `dot` with an interactive browser UI featuring pan/zoom, configurable thresholds, and format selection.

## Requirements

- Python 3.12+
- [Graphviz](https://graphviz.org/) (`dot` command must be available)
- [gprof2dot](https://github.com/jrfonseca/gprof2dot) (defaults to running via `uvx gprof2dot`)

## Installation

Install from PyPI:

```
pip install profinspect
```

Or with [uv](https://docs.astral.sh/uv/):

```
uv pip install profinspect
```

## Usage

```
profinspect [file] [--port PORT] [--no-browser]
```

Run with no arguments to open the UI with an empty file input:

```
profinspect
```

Pass a profile file to open the UI and immediately render the graph:

```
profinspect output.pstats
profinspect --port 8080 callgrind.out
```

The `--no-browser` flag starts the server without opening a browser window.

You can also run as a module:

```
python -m profinspect output.pstats
```

## Supported Profile Formats

All formats supported by gprof2dot: prof, pstats, callgrind, perf, collapse, axe, dtrace, hprof, json, sleepy, sysprof, xperf

The format is auto-detected from the file extension when possible (e.g. `.pstats`, `.prof`, `callgrind.out.*`), otherwise, you can override the format manually in the dropdown.

These correspond to the formats supported by gprof2dot. Common examples:

| Profiler | Format | Example |
|---|---|---|
| Python cProfile / profile | `pstats` | `python -m cProfile -o out.pstats script.py` |
| Linux perf | `perf` | `perf record -g -- ./app && perf script` |
| Valgrind callgrind | `callgrind` | `valgrind --tool=callgrind ./app` |
| gprof | `prof` | `gprof ./app gmon.out` |
| FlameGraph / py-spy | `collapse` | `py-spy record -f raw -o out.collapse` |

## UI Overview

The main view has a collapsible sidebar with options and a pannable/zoomable display area for the SVG graph view.

The graph view updates automatically as you change parameters. You can disable
this if you prefer to control the updates with the "Generate" button (or use
shortcut `Ctrl+Enter`).

**Sidebar options:**

- File picker (browse button) with auto-detected format
- Format dropdown with auto-detect or manual override
- Node and edge threshold sliders (prune low-impact nodes/edges)
- Filters for functions called from/to
- Colormap selection (color, bw, gray, pink, print)
- Advanced: max depth, color skew, path filter, strip C++ names, wrap labels, color by self time, show samples

**Zoom controls:** buttons for zoom in/out, 1:1 reset, and fit-to-view. Mouse wheel zooms at cursor. Click-drag to pan. `Ctrl+Enter` triggers generation.

**Text selection:** click-drag on text within graph nodes to select and copy function names. Panning is disabled over text elements to allow selection.

## Settings

Accessible from the Settings tab in the UI. Persisted to `~/.config/profinspect/settings.json`.

Configurable values:
- command to run gprof2dot (default: `gprof2dot`, you can use `uvx gprof2dot`)
- command to run Graphviz dot (default: `dot`)
- Default values for all generation options (thresholds, colormap, etc.)
