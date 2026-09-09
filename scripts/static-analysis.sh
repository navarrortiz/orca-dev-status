#!/usr/bin/env bash
set -euo pipefail

TARGET_PATH="${1:-orca-dev-status@navarrortiz.github.io.zip}"

if [[ ! -d venv ]]; then
  virtualenv venv
fi

. venv/bin/activate

if ! command -v shexli >/dev/null 2>&1; then
  echo "shexli no está instalado en venv. Instalando..."
  python -m pip install shexli
fi

shexli "$TARGET_PATH"
