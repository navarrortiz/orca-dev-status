---
name: gnome-extension
description: Create and maintain GNOME Shell extensions from this boilerplate using GJS ESM, metadata.json, Makefile, and local install/activation scripts.
metadata:
  short-description: GNOME Shell extension workflow
---

# GNOME Extension Workflow

Use this skill when creating or modifying a GNOME Shell extension based on this repository.

## Project conventions

- Keep `extension.js` focused on the GNOME lifecycle: `enable()` and `disable()`.
- Put extension coordination in `src/extension/`, UI in `src/ui/`, and shared values in `src/shared/`.
- Keep the extension compatible with GNOME Shell 45+ and use GJS ES modules.
- Treat `metadata.json` as the source of truth for the extension UUID, name, description, and supported shell versions.
- Keep `one-thing-extended` as a reference for modularity, providers, preferences, and schemas; do not copy those features unless the new extension needs them.

## Start a new extension

1. Run `scripts/generate-gnome-extension.sh <destination> <uuid> [name]`.
2. Update `metadata.json` and replace the sample UI or D-Bus client.
3. Add schemas only when settings are needed; compile them with `make schemas`.
4. Build with `make bundle` or `npm run build`.
5. Install with `make install` and activate with `make activate`.

## Important checks

- The UUID passed to the generator must match `metadata.json` and the install directory.
- Do not include development-only files in a distributable ZIP.
- When changing a module imported by `extension.js`, inspect its enable/disable cleanup so signals, actors, and proxies are released.
- Keep one session checklist under `docs/checklist/todo/` until the user validates the result; move it to `docs/checklist/done/` only after explicit confirmation.
