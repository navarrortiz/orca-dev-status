#!/usr/bin/env bash
set -euo pipefail

UUID="${1:-orca-dev-status@navarrortiz.github.io}"

if [[ "${XDG_SESSION_TYPE:-}" != "wayland" ]]; then
  echo "La sesión GNOME anidada requiere Wayland." >&2
  echo "En X11, pulsa Alt+F2 y ejecuta 'restart' para recargar la extensión." >&2
  exit 1
fi

shell_major="$(gnome-shell --version | sed -E 's/.* ([0-9]+)(\..*)?$/\1/')"
if [[ ! "${shell_major}" =~ ^[0-9]+$ ]]; then
  echo "No se pudo detectar la versión de GNOME Shell." >&2
  exit 1
fi

if (( shell_major >= 49 )); then
  if [[ ! -x /usr/lib/mutter-devkit && ! -x /usr/libexec/mutter-devkit ]] &&
      ! command -v mutter-devkit >/dev/null 2>&1; then
    echo "Falta Mutter Development Kit, necesario desde GNOME 49." >&2
    echo "Instala 'mutter-devkit' (Arch/Fedora) o 'mutter-dev-bin' (Ubuntu)." >&2
    exit 1
  fi
  mode="--devkit"
else
  mode="--nested"
fi

echo "Abriendo GNOME Shell ${shell_major} en una ventana de prueba..."
echo "Pulsa Ctrl+C para cerrarla."

dbus-run-session -- bash -euo pipefail -c '
  uuid="$1"
  mode="$2"

  gnome-shell "$mode" --wayland &
  shell_pid=$!

  cleanup() {
    kill "$shell_pid" 2>/dev/null || true
    wait "$shell_pid" 2>/dev/null || true
  }
  trap cleanup EXIT INT TERM

  gdbus wait --session --timeout 20 org.gnome.Shell
  gnome-extensions enable "$uuid"
  wait "$shell_pid"
' dev-extension "$UUID" "$mode"
