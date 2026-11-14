#!/bin/sh
# Refreshes reference/ from upstream: VS Code's color registry, the theming docs,
# and the built-in default themes. Afterwards run `npm run check` to see whether
# new VS Code colors fall back to stock values.
#
#   VSCODE_DIR=/path/to/existing/vscode/checkout sh tools/sync-vscode.sh
set -eu

ROOT=$(cd "$(dirname "$0")/.." && pwd)
VSCODE_DIR=${VSCODE_DIR:-"$ROOT/.cache/vscode"}
REF="$ROOT/reference"

if [ ! -d "$VSCODE_DIR/.git" ]; then
  echo "Cloning microsoft/vscode (sparse) into $VSCODE_DIR"
  git clone -q --depth 1 --filter=blob:none --sparse https://github.com/microsoft/vscode.git "$VSCODE_DIR"
else
  echo "Updating $VSCODE_DIR"
  git -C "$VSCODE_DIR" fetch -q --depth 1 origin main
  git -C "$VSCODE_DIR" checkout -q --detach FETCH_HEAD
fi
git -C "$VSCODE_DIR" sparse-checkout set src/vs extensions/git extensions/theme-defaults

node "$ROOT/tools/extract-registry.js" "$VSCODE_DIR" "$REF/color-registry.json"

mkdir -p "$REF/vscode-default-themes"
for t in 2026-dark dark_modern dark_plus dark_vs; do
  cp "$VSCODE_DIR/extensions/theme-defaults/themes/$t.json" "$REF/vscode-default-themes/"
done

DOCS=https://raw.githubusercontent.com/microsoft/vscode-docs/main/api
curl -fsSL -o "$REF/theme-color.md" "$DOCS/references/theme-color.md"
curl -fsSL -o "$REF/color-theme.md" "$DOCS/extension-guides/color-theme.md"
curl -fsSL -o "$REF/semantic-highlight-guide.md" "$DOCS/language-extensions/semantic-highlight-guide.md"

echo "Reference updated. Run: npm run check"
