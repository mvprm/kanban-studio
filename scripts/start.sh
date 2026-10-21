#!/bin/sh
set -e
cd "$(dirname "$0")/.."
docker compose up -d --build
echo "Running at http://localhost:8000"
