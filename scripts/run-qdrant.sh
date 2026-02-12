#!/usr/bin/env bash
# Run Qdrant vector DB in Docker (API on 6333, gRPC on 6334).
# Requires Docker Desktop to be running.
set -e
cd "$(dirname "$0")/.."
mkdir -p qdrant_storage
docker run -p 6333:6333 -p 6334:6334 \
  -v "$(pwd)/qdrant_storage:/qdrant/storage:z" \
  qdrant/qdrant
