#!/usr/bin/env bash
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Candidate virtualenv python locations (relative to project)
CANDIDATES=("$DIR/../.venv/bin/python" "$DIR/../venv/bin/python" "$DIR/../env/bin/python")
PYTHON=""
for p in "${CANDIDATES[@]}"; do
  if [ -x "$p" ]; then
    PYTHON="$p"
    break
  fi
done

# If not found, prefer poetry if available
USE_POETRY=0
if [ -z "$PYTHON" ]; then
  if command -v poetry >/dev/null 2>&1; then
    USE_POETRY=1
  else
    PYTHON="$(command -v python3 || command -v python)"
  fi
fi

echo "Heartbeat runner using: ${PYTHON:-poetry run python}"

if [ "$USE_POETRY" -eq 1 ]; then
  exec poetry run python "$DIR/heartbeat_checker.py"
else
  exec "$PYTHON" "$DIR/heartbeat_checker.py"
fi
