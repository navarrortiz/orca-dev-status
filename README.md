# GNOME Shell Extension Boilerplate

This repository contains a working GNOME Shell extension (Shell 45+) and a boilerplate based on GJS ESM. Once installed, it displays `Hello word!` in the top bar.

## What's included

- `metadata.json` with the extension's `uuid` and basic metadata.
- `extension.js` with the `enable/disable` lifecycle.
- A `src/` directory containing:
  - `extension/` for the extension controller.
  - `ui/` for the panel UI.
  - `shared/` for shared state utilities.
- `scripts/build.sh`, `scripts/generate-gnome-extension.sh`, `scripts/install-extension.sh`, `scripts/activate-extension.sh`, and a `Makefile` for generating, installing, and activating the extension.
- `stylesheet.css` with base styles.

## Quick start

1. Edit `metadata.json` if you plan to turn this boilerplate into a different extension:
   - `uuid` (required and unique).
   - `name` and `description`.
   - `url` (optional but recommended).
2. Build, install, and activate it:

```bash
make install
make activate
```

You can also run `npm run dev`.

## GNOME skill (starter template)

To generate a copy of this boilerplate in another project:

```bash
./scripts/generate-gnome-extension.sh /path/to/new/project my.extension@domain "My Extension"
```

The script creates the base structure and replaces the `uuid` and name.

## Local installation (optional)

```bash
gnome-extensions pack . --force --gresource --dest=~/.local/share/gnome-shell/extensions
```

```bash
make install
make schemas   # only if you add schemas/
```

To install and activate it quickly:

```bash
make install && ./scripts/activate-extension.sh my.extension@domain
```

Alternatively, install the generated ZIP using your preferred method.

## Structure

```text
├── extension.js
├── metadata.json
├── stylesheet.css
├── Makefile
├── scripts/
│   ├── activate-extension.sh
│   ├── build.sh
│   ├── generate-gnome-extension.sh
│   └── install-extension.sh
└── src/
    ├── extension/
    │   └── controller.js
    ├── ui/
    │   └── indicator.js
    └── shared/
        └── constants.js
```
