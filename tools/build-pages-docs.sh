#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="$ROOT/web/out"
DOCS="$ROOT/docs"

cd "$ROOT"
pnpm run build:pages
: > "$OUT/.nojekyll"
mkdir -p "$DOCS"
cp -R "$OUT/." "$DOCS/"

printf 'Built GitHub Pages files in %s\n' "$DOCS"
printf 'Review and commit docs/ on the default branch to publish.\n'
