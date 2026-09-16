import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeTerminalScreenDetails } from '../src/orca/session-details.js';

test('extrae modelo y esfuerzo de la barra inferior de Codex', () => {
  const details = normalizeTerminalScreenDetails({
    ok: true,
    result: {
      terminal: {
        tail: [
          '› Ask Codex to do anything',
          '  gpt-5.6-sol medium · ~/Proyectos/orca-dev-status · Continuar',
        ],
      },
    },
  });

  assert.deepEqual(details, { model: 'gpt-5.6-sol', effort: 'medium' });
});

test('devuelve detalles vacíos si la pantalla no contiene identidad', () => {
  assert.deepEqual(normalizeTerminalScreenDetails({ ok: true, result: {} }), {
    model: null,
    effort: null,
  });
});
