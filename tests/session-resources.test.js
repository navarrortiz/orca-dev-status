import assert from 'node:assert/strict';
import test from 'node:test';

import {
  formatDuration,
  formatMemory,
  normalizeResourceResponse,
  SessionResourceService,
} from '../src/orca/session-resources.js';

function response(sessions, extra = {}) {
  return {
    ok: true,
    result: {
      collectedAt: 1234,
      processMemoryMetric: 'rss',
      worktrees: [{ sessions }],
      ...extra,
    },
  };
}

test('normaliza recursos por paneKey', () => {
  const resources = normalizeResourceResponse(response([
    { paneKey: 'tab:leaf', pid: 42, cpu: 125.25, memory: 1572864 },
    { pid: 99, cpu: 1, memory: 2 },
  ]));

  assert.deepEqual(resources.get('tab:leaf'), {
    pid: 42,
    cpu: 125.25,
    memory: 1572864,
    collectedAt: 1234,
    memoryMetric: 'rss',
  });
  assert.equal(resources.size, 1);
});

test('tolera worktrees sin sesiones y rechaza envelopes inválidos', () => {
  assert.equal(normalizeResourceResponse(response([], {
    worktrees: [{ sessions: null }, {}],
  })).size, 0);
  for (const value of [null, {}, { ok: false }, { ok: true, result: {} }])
    assert.throws(() => normalizeResourceResponse(value), /recursos inválida/);
});

test('formatea memoria y duraciones compactas', () => {
  assert.equal(formatMemory(0), '0.0 MiB');
  assert.equal(formatMemory(1572864), '1.5 MiB');
  assert.equal(formatMemory(1610612736), '1.5 GiB');
  assert.equal(formatMemory(null), null);
  assert.equal(formatDuration(59000), '59 s');
  assert.equal(formatDuration(120000), '2 min');
  assert.equal(formatDuration(7200000), '2 h');
  assert.equal(formatDuration(172800000), '2 d');
});

test('comparte la consulta y conserva la caché durante cinco segundos', async () => {
  let now = 1000;
  let calls = 0;
  const sessions = new Map([['tab:leaf', { pid: 42 }]]);
  const client = {
    async fetchResources() {
      calls++;
      return sessions;
    },
  };
  const service = new SessionResourceService(client, 5000, () => now);

  const [first, second] = await Promise.all([
    service.get('tab:leaf'),
    service.get('tab:leaf'),
  ]);
  assert.equal(first.pid, 42);
  assert.equal(second.pid, 42);
  assert.equal(calls, 1);

  now = 5999;
  await service.get('missing');
  assert.equal(calls, 1);
  now = 6000;
  await service.get('tab:leaf');
  assert.equal(calls, 2);
});
