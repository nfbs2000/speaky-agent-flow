#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="$ROOT/web/out"

cd "$ROOT"
pnpm run build:pages
: > "$OUT/.nojekyll"

source_sha="$(git rev-parse HEAD)"
printf '{\n  "sourceCommit": "%s",\n  "deploymentMethod": "local-gh-pages"\n}\n' \
  "$source_sha" > "$OUT/deployment.json"

index_dir="$(mktemp -d)"
index_file="$index_dir/index"
trap 'rm -f "$index_file"; rmdir "$index_dir"' EXIT

export GIT_INDEX_FILE="$index_file"
git --git-dir="$ROOT/.git" --work-tree="$OUT" read-tree --empty
git --git-dir="$ROOT/.git" --work-tree="$OUT" add -A
tree="$(git --git-dir="$ROOT/.git" write-tree)"

remote_head="$(git ls-remote --heads origin refs/heads/gh-pages | cut -f1)"
if [[ -n "$remote_head" ]]; then
  git fetch origin gh-pages
  parent="$(git rev-parse FETCH_HEAD)"
  commit="$(printf 'Deploy %s\n' "$source_sha" | git commit-tree "$tree" -p "$parent")"
else
  commit="$(printf 'Deploy %s\n' "$source_sha" | git commit-tree "$tree")"
fi

git push origin "$commit:refs/heads/gh-pages"
printf 'Published %s from source %s\n' "$commit" "$source_sha"
