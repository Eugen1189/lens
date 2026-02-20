#!/usr/bin/env bash
# LegacyLens Setup Skills — install agent skills into Cursor, Claude Code, Antigravity.
# Runs the cross-platform Node script (works on Windows when invoked via CLI).
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
exec node "$SCRIPT_DIR/install-skills.js"
