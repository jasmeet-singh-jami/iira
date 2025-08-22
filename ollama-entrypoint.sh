#!/bin/sh
set -e

# Ensure curl is installed (Ollama base image is minimal)
apk add --no-cache curl || apt-get update && apt-get install -y curl || true

# Start Ollama server in background
/entrypoint.sh &

# Give Ollama a few seconds to start
sleep 5

# Pull llama3 if not already available
if ! curl -s http://localhost:11434/api/tags | grep -q "llama3"; then
  echo "Pulling llama3 model..."
  curl -s http://localhost:11434/api/pull -d '{"name": "llama3"}'
else
  echo "llama3 already present, skipping pull."
fi

# Keep container running in foreground
wait -n
