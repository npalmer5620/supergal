#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

pids=()
names=()
cleanup_in_progress=0

cleanup() {
    local code="${1:-0}"
    if [ "$cleanup_in_progress" -eq 1 ]; then
        exit "$code"
    fi
    cleanup_in_progress=1

    trap - INT TERM

    if [ "${#pids[@]}" -gt 0 ]; then
        printf '\nStopping dev servers...\n' >&2
        for pid in "${pids[@]}"; do
            if kill -0 "$pid" 2>/dev/null; then
                kill -INT "$pid" 2>/dev/null || true
            fi
        done
        # Give processes a moment to exit gracefully before forcing termination.
        sleep 1
        for pid in "${pids[@]}"; do
            if kill -0 "$pid" 2>/dev/null; then
                kill -TERM "$pid" 2>/dev/null || true
            fi
        done
        for pid in "${pids[@]}"; do
            if kill -0 "$pid" 2>/dev/null; then
                wait "$pid" 2>/dev/null || true
            fi
        done
    fi

    exit "$code"
}

trap 'cleanup 130' INT TERM

start_process() {
    local name="$1"
    shift
    printf 'Starting %s dev server...\n' "$name" >&2
    "$@" &
    local pid=$!
    pids+=("$pid")
    names+=("$name")
}

cd "$ROOT_DIR"

start_process "api" npm run dev --workspace api
start_process "web" npm run dev --workspace web

while true; do
    for i in "${!pids[@]}"; do
        pid="${pids[$i]}"
        name="${names[$i]}"
        if ! kill -0 "$pid" 2>/dev/null; then
            set +e
            wait "$pid"
            status=$?
            set -e
            printf '\n%s dev server exited with status %s\n' "$name" "$status" >&2
            cleanup "$status"
        fi
    done
    sleep 1
done
