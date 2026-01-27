# Profecy

A local web app for visualizing profiling data. Wraps [gprof2dot](https://github.com/jrfonseca/gprof2dot) and Graphviz `dot` with an interactive browser UI featuring pan/zoom, configurable thresholds, and format selection.

## Requirements

- Python 3.12+
- [Graphviz](https://graphviz.org/) (`dot` command must be available)
- [gprof2dot](https://github.com/jrfonseca/gprof2dot) (defaults to running via `uvx gprof2dot`)

## Installation

```
pip install -e .
```

Or with [uv](https://docs.astral.sh/uv/):

```
uv sync
```

## Usage

```
profecy [file] [--port PORT] [--no-browser]
```

Run with no arguments to open the UI with an empty file input:

```
profecy
```

Pass a profile file to open the UI and immediately render the graph:

```
profecy output.pstats
profecy --port 8080 callgrind.out
```

The `--no-browser` flag starts the server without opening a browser window.

You can also run as a module:

```
python -m profecy output.pstats
```

## Supported Profile Formats

prof, pstats, callgrind, perf, collapse, axe, dtrace, hprof, json, sleepy, sysprof, xperf

These correspond to the formats supported by gprof2dot. Common examples:

| Profiler | Format | Example |
|---|---|---|
| Python cProfile / profile | `pstats` | `python -m cProfile -o out.pstats script.py` |
| Linux perf | `perf` | `perf record -g -- ./app && perf script` |
| Valgrind callgrind | `callgrind` | `valgrind --tool=callgrind ./app` |
| gprof | `prof` | `gprof ./app gmon.out` |
| FlameGraph / py-spy | `collapse` | `py-spy record -f raw -o out.collapse` |

## UI Overview

The main view has a collapsible sidebar with options and a pannable/zoomable SVG display area.

**Sidebar options:**
- File path and format selection
- Node and edge threshold sliders (prune low-impact nodes/edges)
- Colormap selection (color, bw, gray, pink, print)
- Checkboxes: strip C++ names, wrap labels, color by self time, show samples
- Advanced: root/leaf function filters, max depth, color skew, path filter

**Zoom controls:** buttons for zoom in/out, 1:1 reset, and fit-to-view. Mouse wheel zooms at cursor. Click-drag to pan. `Ctrl+Enter` triggers generation.

## Settings

Accessible from the Settings tab in the UI. Persisted to `~/.config/profecy/settings.json`.

Configurable values:
- `gprof2dot_command` -- command to run gprof2dot (default: `uvx gprof2dot`)
- `dot_command` -- command to run Graphviz dot (default: `dot`)
- Default values for all generation options (format, thresholds, colormap, etc.)
