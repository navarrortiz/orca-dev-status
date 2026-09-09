.PHONY: build bundle clean install activate dev schemas

UUID := orca-dev-status@navarrortiz.github.io
BUNDLE ?= $(UUID).zip
ASSETS := $(wildcard assets/*)
SCHEMAS := $(wildcard schemas/*.gschema.xml)
MODULES := $(shell find src -type f | sort)
SOURCES := extension.js prefs.js metadata.json stylesheet.css $(MODULES) $(ASSETS) $(SCHEMAS)
PREFIX ?= ${HOME}/.local
SCHEMAS_COMPILED := schemas/gschemas.compiled

build:
	bash scripts/build.sh

schemas: $(SCHEMAS_COMPILED)

ifeq ($(strip $(SCHEMAS)),)
$(SCHEMAS_COMPILED):
	@:
else
$(SCHEMAS_COMPILED): $(SCHEMAS)
	glib-compile-schemas schemas/
endif

$(BUNDLE): $(SOURCES) $(SCHEMAS_COMPILED)
	rm -f "$@"
	zip -q "$@" $(SOURCES)

bundle: $(BUNDLE)

clean:
	rm -rf dist "$(BUNDLE)" "$(SCHEMAS_COMPILED)"

install: $(BUNDLE)
	bash scripts/install-extension.sh "$(BUNDLE)" "$(PREFIX)" "$(UUID)"

activate:
	bash scripts/activate-extension.sh "$(UUID)"

dev: install
	bash scripts/dev-extension.sh "$(UUID)"
