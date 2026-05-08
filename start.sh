#!/usr/bin/env bash
set -e

cd "$(dirname "$0")"

echo "=== Install dependencies ==="
npm install

echo "=== Build frontend ==="
npm run build

echo "=== Start server ==="
echo "Server will run on http://0.0.0.0:${PORT:-3000}"
fuser -k ${PORT:-3000}/tcp 2>/dev/null || true
npm run server
