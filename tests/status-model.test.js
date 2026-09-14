import assert from 'node:assert/strict';
import test from 'node:test';

import {
  AGENT_STATUS,
  normalizeOrcaResponse,
  normalizeTerminalTitles,
  requiresCloseConfirmation,
  unavailableStatus,
} from '../src/orca/status-model.js';

function response(worktrees) {
  return { ok: true, result: { worktrees } };
}

test('normaliza workspaces, títulos y prioridad global', () => {
  const snapshot = normalizeOrcaResponse(response([
    { displayName: 'vacío', agents: [] },
    {
      worktreeId: 'repo::/ruta/orca-dev-status',
      displayName: 'orca-dev-status',
      agents: [
        {
          displayName: 'Diseño',
          agentType: 'Claude',
          paneKey: 'tab:leaf',
          state: 'waiting',
          toolName: 'request_user_input',
          prompt: 'dato privado',
        },
        { taskTitle: 'Build', state: 'working' },
      ],
    },
    {
      repo: 'api',
      agents: [
        { agentType: 'claude', prompt: 'Corrige el endpoint de usuarios', state: 'done' },
        { agentType: 'codex', state: 'working', interrupted: true },
      ],
    },
  ]));

  assert.equal(snapshot.activeCount, 3);
  assert.equal(snapshot.totalCount, 4);
  assert.equal(snapshot.status, AGENT_STATUS.QUESTION);
  assert.deepEqual(snapshot.counts, {
    question: 1,
    attention: 1,
    working: 1,
    finished: 1,
  });
  assert.deepEqual(snapshot.workspaces.map(item => item.name), [
    'orca-dev-status',
    'api',
  ]);
  assert.deepEqual(snapshot.workspaces[0].agents.map(agent => agent.name), [
    'Diseño',
    'Build',
  ]);
  assert.equal(snapshot.workspaces[0].id, 'repo::/ruta/orca-dev-status');
  assert.deepEqual(snapshot.workspaces[0].agents[0], {
    name: 'Diseño',
    type: 'claude',
    model: null,
    paneKey: 'tab:leaf',
    status: AGENT_STATUS.QUESTION,
    prompt: 'dato privado',
    lastAssistantMessage: '',
    toolName: 'request_user_input',
    stateStartedAt: null,
    updatedAt: null,
  });
  assert.deepEqual(snapshot.workspaces[1].agents.map(agent => agent.name), [
    'Corrige el endpoint de usuarios',
    'codex',
  ]);
  assert.match(JSON.stringify(snapshot), /dato privado/);
});

test('conserva los detalles técnicos disponibles para la tarjeta', () => {
  const snapshot = normalizeOrcaResponse(response([{
    displayName: 'proyecto',
    agents: [{
      agentType: 'codex',
      modelName: 'gpt-5',
      prompt: 'último prompt',
      lastAssistantMessage: 'respuesta reciente',
      toolName: 'Bash',
      state: 'working',
      stateStartedAt: 1000,
      updatedAt: 2000,
    }],
  }]));
  const [agent] = snapshot.workspaces[0].agents;

  assert.equal(agent.model, 'gpt-5');
  assert.equal(agent.prompt, 'último prompt');
  assert.equal(agent.lastAssistantMessage, 'respuesta reciente');
  assert.equal(agent.toolName, 'Bash');
  assert.equal(agent.stateStartedAt, 1000);
  assert.equal(agent.updatedAt, 2000);
});

test('confirma el cierre solo cuando la sesión requiere atención', () => {
  assert.equal(requiresCloseConfirmation(AGENT_STATUS.QUESTION), true);
  assert.equal(requiresCloseConfirmation(AGENT_STATUS.ATTENTION), true);
  assert.equal(requiresCloseConfirmation(AGENT_STATUS.WORKING), false);
  assert.equal(requiresCloseConfirmation(AGENT_STATUS.FINISHED), false);
});

test('combina el proyecto y el worktree cuando tienen nombres distintos', () => {
  const snapshot = normalizeOrcaResponse(response([{
    repo: 'orca-dev-status',
    displayName: 'feature/orca-status-v1',
    agents: [{ state: 'working' }],
  }]));

  assert.equal(snapshot.workspaces[0].name,
    'orca-dev-status · feature/orca-status-v1');
});

test('acorta el título de sesión a una sola línea', () => {
  const prompt = `${'Título largo '.repeat(8)}\ncontenido adicional`;
  const snapshot = normalizeOrcaResponse(response([{
    displayName: 'proyecto',
    agents: [{ agentType: 'codex', prompt, state: 'working' }],
  }]));
  const [agent] = snapshot.workspaces[0].agents;

  assert.equal(agent.name.length, 60);
  assert.match(agent.name, /…$/);
  assert.doesNotMatch(agent.name, /contenido adicional/);
});

test('presenta los prompts como los nombres de sesión de Orca', () => {
  const snapshot = normalizeOrcaResponse(response([{
    displayName: 'proyecto',
    agents: [
      { prompt: '[Image #1]  corrige el icono', state: 'working' },
      { prompt: 'que estrategia recomiendas', state: 'done' },
    ],
  }]));

  assert.deepEqual(snapshot.workspaces[0].agents.map(agent => agent.name), [
    'Image 1 corrige el icono',
    'Que estrategia recomiendas',
  ]);
});

test('conserva el primer prompt observado para cada sesión', () => {
  const firstPrompts = new Map();
  const worktree = prompt => ({
    displayName: 'proyecto',
    agents: [{ paneKey: 'tab:leaf', prompt, state: 'working' }],
  });

  normalizeOrcaResponse(response([worktree('primer prompt')]), firstPrompts);
  const snapshot = normalizeOrcaResponse(
    response([worktree('Implement the plan.')]),
    firstPrompts,
  );

  assert.equal(snapshot.workspaces[0].agents[0].name, 'Primer prompt');
});

test('prefiere el título manual de la terminal sobre el nombre de sesión', () => {
  const terminalTitles = normalizeTerminalTitles({
    result: {
      terminals: [
        {
          tabId: 'tab',
          leafId: 'leaf',
          title: '⠙ Nombre de sesión | orca-dev-status',
        },
        { tabId: 'empty', leafId: 'leaf', title: '   ' },
      ],
      visualLayouts: [{
        root: {
          tabs: [{ tabId: 'tab', title: 'Título manual' }],
        },
      }],
    },
  });
  const snapshot = normalizeOrcaResponse(response([{
    displayName: 'proyecto',
    agents: [
      {
        paneKey: 'tab:leaf',
        displayName: 'Nombre de sesión',
        prompt: 'primer prompt',
        state: 'working',
      },
      { paneKey: 'missing:leaf', prompt: 'fallback', state: 'done' },
    ],
  }]), new Map(), terminalTitles);

  assert.deepEqual(snapshot.workspaces[0].agents.map(agent => agent.name), [
    'Título manual',
    'Fallback',
  ]);
});

test('aplica atención antes de trabajo y trata estados desconocidos como atención', () => {
  const snapshot = normalizeOrcaResponse(response([{
    path: '/tmp/proyecto',
    agents: [
      { agentType: 'codex', state: 'working' },
      { state: 'nuevo-estado' },
    ],
  }]));

  assert.equal(snapshot.status, AGENT_STATUS.ATTENTION);
  assert.equal(snapshot.activeCount, 2);
  assert.equal(snapshot.workspaces[0].name, 'proyecto');
  assert.equal(snapshot.workspaces[0].agents[1].name, 'Agente');
});

test('presenta verde cuando todos finalizaron o no hay agentes', () => {
  const finished = normalizeOrcaResponse(response([{
    displayName: 'listo',
    agents: [{ state: 'completed' }, { state: 'succeeded' }],
  }]));
  const empty = normalizeOrcaResponse(response([]));

  assert.equal(finished.activeCount, 0);
  assert.equal(finished.status, AGENT_STATUS.FINISHED);
  assert.equal(empty.activeCount, 0);
  assert.equal(empty.status, AGENT_STATUS.FINISHED);
});

test('rechaza envelopes inválidos', () => {
  for (const value of [null, {}, { ok: false }, { ok: true, result: {} }])
    assert.throws(() => normalizeOrcaResponse(value), /Respuesta inválida/);
});

test('crea un snapshot indisponible sin datos obsoletos', () => {
  assert.deepEqual(unavailableStatus(), {
    available: false,
    workspaces: [],
    counts: { question: 0, attention: 0, working: 0, finished: 0 },
    totalCount: 0,
    activeCount: 0,
    status: null,
  });
});
