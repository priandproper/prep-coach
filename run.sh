#!/usr/bin/env bash
# Launch prep-coach locally. Serving over http://localhost is required so the
# browser Notifications API works (it is disabled on file:// pages).
set -e
cd "$(dirname "$0")"
PORT="${1:-8000}"
echo "prep-coach → http://localhost:${PORT}"
echo "Press Ctrl+C to stop."
python3 -m http.server "$PORT"
