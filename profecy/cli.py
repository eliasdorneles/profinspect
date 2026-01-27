"""CLI entry point: parse args, start Flask server, open browser."""

import argparse
import socket
import threading
import webbrowser

from .app import create_app


def find_free_port() -> int:
    """Find an available port by binding to port 0."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def main():
    parser = argparse.ArgumentParser(
        prog="profecy",
        description="Interactive profiling data visualizer (gprof2dot + Graphviz)",
    )
    parser.add_argument("file", nargs="?", default=None, help="Profile file to load on startup")
    parser.add_argument("--port", type=int, default=0, help="Port to listen on (default: auto)")
    parser.add_argument("--no-browser", action="store_true", help="Don't auto-open browser")
    args = parser.parse_args()

    port = args.port if args.port else find_free_port()
    app = create_app(initial_file=args.file)

    url = f"http://127.0.0.1:{port}"

    if not args.no_browser:
        # Open browser after a short delay to let the server start
        threading.Timer(0.5, webbrowser.open, args=[url]).start()

    print(f"Profecy running at {url}")
    print("Press Ctrl+C to quit")
    app.run(host="127.0.0.1", port=port, debug=False)
