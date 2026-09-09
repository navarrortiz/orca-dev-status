#!/usr/bin/env bash
set -euo pipefail

BUNDLE="${1:?Usage: install-extension.sh <zip-file> [prefix] [uuid]}"
PREFIX="${2:-${HOME}/.local}"
UUID="${3:-orca-dev-status@navarrortiz.github.io}"

EXT_DIR="${PREFIX}/share/gnome-shell/extensions/${UUID}"

mkdir -p "${EXT_DIR}"
unzip -oq "${BUNDLE}" -d "${EXT_DIR}"

if [ -d "${EXT_DIR}/schemas" ] && [ -n "$(find "${EXT_DIR}/schemas" -maxdepth 1 -name '*.gschema.xml' -print -quit)" ]; then
  glib-compile-schemas "${EXT_DIR}/schemas"
fi

echo "Installed ${UUID} to ${EXT_DIR}"
