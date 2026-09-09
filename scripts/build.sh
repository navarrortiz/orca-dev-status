#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST="$ROOT/dist"
rm -rf "$DIST"
mkdir -p "$DIST"
mkdir -p "$DIST/src"
cp -R "$ROOT/src/." "$DIST/src/"
cp "$ROOT/extension.js" "$ROOT/prefs.js" "$ROOT/metadata.json" "$ROOT/stylesheet.css" "$DIST/"
if [[ -d "$ROOT/assets" ]]; then
    cp -R "$ROOT/assets" "$DIST/"
fi
if compgen -G "$ROOT/schemas/*.gschema.xml" >/dev/null; then
    mkdir -p "$DIST/schemas"
    cp "$ROOT"/schemas/*.gschema.xml "$DIST/schemas/"
    glib-compile-schemas "$DIST/schemas"
fi
echo "GNOME extension built at $DIST"
