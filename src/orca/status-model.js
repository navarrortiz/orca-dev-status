export const AGENT_STATUS = Object.freeze({
  QUESTION: 'question',
  ATTENTION: 'attention',
  WORKING: 'working',
  FINISHED: 'finished',
});

export function requiresCloseConfirmation(status) {
  return status === AGENT_STATUS.QUESTION || status === AGENT_STATUS.ATTENTION;
}

const FINISHED_STATES = new Set([
  'complete',
  'completed',
  'done',
  'finished',
  'success',
  'succeeded',
]);
const WORKING_STATES = new Set(['active', 'running', 'working']);
const ATTENTION_STATES = new Set([
  'attention',
  'blocked',
  'error',
  'failed',
  'interrupted',
  'waiting',
]);
const MAX_AGENT_NAME_LENGTH = 60;

function classifyAgent(agent) {
  const state = String(agent.state ?? '').toLowerCase();
  const toolName = String(agent.toolName ?? '').toLowerCase();
  const wait = String(agent.agentWait?.kind ?? agent.waitReason ?? '').toLowerCase();

  if (
    state.includes('question') || state.includes('input') ||
    toolName.includes('question') || toolName.includes('askuser') ||
    toolName.includes('request_user_input') ||
    wait.includes('question') || wait.includes('input')
  )
    return AGENT_STATUS.QUESTION;

  if (agent.interrupted || ATTENTION_STATES.has(state))
    return AGENT_STATUS.ATTENTION;
  if (WORKING_STATES.has(state))
    return AGENT_STATUS.WORKING;
  if (FINISHED_STATES.has(state))
    return AGENT_STATUS.FINISHED;

  return AGENT_STATUS.ATTENTION;
}

function agentName(agent, firstPrompts, terminalTitles) {
  const prompt = String(agent.prompt ?? '')
    .trim()
    .split(/\r?\n/, 1)[0]
    .replace(/\[Image #(\d+)\]/g, 'Image $1')
    .replace(/\s+/g, ' ');
  let normalizedPrompt = prompt
    ? `${prompt[0].toUpperCase()}${prompt.slice(1)}`
    : '';
  if (agent.paneKey && normalizedPrompt && firstPrompts) {
    if (!firstPrompts.has(agent.paneKey))
      firstPrompts.set(agent.paneKey, normalizedPrompt);
    normalizedPrompt = firstPrompts.get(agent.paneKey);
  }
  const name = terminalTitles?.get(agent.paneKey) || agent.displayName ||
    agent.taskTitle || normalizedPrompt || agent.agentType || 'Agente';
  const firstLine = String(name).trim().split(/\r?\n/, 1)[0];
  return firstLine.length > MAX_AGENT_NAME_LENGTH
    ? `${firstLine.slice(0, MAX_AGENT_NAME_LENGTH - 1)}…`
    : firstLine;
}

export function normalizeTerminalTitles(payload) {
  const titles = new Map();
  for (const terminal of payload?.result?.terminals ?? []) {
    if (!terminal?.tabId || !terminal?.leafId)
      continue;

    const title = String(terminal.title ?? '')
      .replace(/^[\u2800-\u28ff]\s+/, '')
      .replace(/\s+\|\s+[^|]+$/, '')
      .trim();
    if (title)
      titles.set(`${terminal.tabId}:${terminal.leafId}`, title);
  }
  return titles;
}

function workspaceName(workspace) {
  if (workspace.repo && workspace.displayName && workspace.repo !== workspace.displayName)
    return `${workspace.repo} · ${workspace.displayName}`;
  if (workspace.repo || workspace.displayName)
    return workspace.repo || workspace.displayName;

  return String(workspace.path ?? 'Workspace').split('/').filter(Boolean).at(-1) || 'Workspace';
}

function countsFor(agents) {
  const counts = {
    question: 0,
    attention: 0,
    working: 0,
    finished: 0,
  };
  for (const agent of agents)
    counts[agent.status]++;
  return counts;
}

function highestStatus(counts) {
  if (counts.question)
    return AGENT_STATUS.QUESTION;
  if (counts.attention)
    return AGENT_STATUS.ATTENTION;
  if (counts.working)
    return AGENT_STATUS.WORKING;
  return AGENT_STATUS.FINISHED;
}

export function normalizeOrcaResponse(payload, firstPrompts, terminalTitles) {
  if (!payload || payload.ok !== true || !Array.isArray(payload.result?.worktrees))
    throw new Error('Respuesta inválida de Orca');

  const workspaces = payload.result.worktrees.flatMap(workspace => {
    if (!Array.isArray(workspace?.agents) || workspace.agents.length === 0)
      return [];

    const agents = workspace.agents.map(agent => ({
      name: agentName(agent, firstPrompts, terminalTitles),
      type: String(agent.agentType ?? 'agent').toLowerCase(),
      model: agent.model ?? agent.modelName ?? null,
      paneKey: agent.paneKey ?? null,
      status: classifyAgent(agent),
      prompt: String(agent.prompt ?? '').trim(),
      lastAssistantMessage: String(agent.lastAssistantMessage ?? '').trim(),
      toolName: agent.toolName ?? null,
      stateStartedAt: Number.isFinite(agent.stateStartedAt)
        ? agent.stateStartedAt
        : null,
      updatedAt: Number.isFinite(agent.updatedAt) ? agent.updatedAt : null,
    }));
    const counts = countsFor(agents);
    return [{
      id: workspace.worktreeId ?? null,
      name: workspaceName(workspace),
      agents,
      counts,
      status: highestStatus(counts),
    }];
  });

  const agents = workspaces.flatMap(workspace => workspace.agents);
  const counts = countsFor(agents);
  return {
    available: true,
    workspaces,
    counts,
    totalCount: agents.length,
    activeCount: agents.length - counts.finished,
    status: highestStatus(counts),
  };
}

export function unavailableStatus() {
  return {
    available: false,
    workspaces: [],
    counts: { question: 0, attention: 0, working: 0, finished: 0 },
    totalCount: 0,
    activeCount: 0,
    status: null,
  };
}
