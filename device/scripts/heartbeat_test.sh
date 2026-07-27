#!/usr/bin/env bash
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

exec /bin/bash "$DIR/run_heartbeat.sh"
