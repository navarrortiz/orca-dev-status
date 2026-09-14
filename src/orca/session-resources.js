const DEFAULT_TTL_MS = 5000;

export function formatDuration(milliseconds) {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  if (seconds < 60)
    return `${seconds} s`;
  if (seconds < 3600)
    return `${Math.floor(seconds / 60)} min`;
  if (seconds < 86400)
    return `${Math.floor(seconds / 3600)} h`;
  return `${Math.floor(seconds / 86400)} d`;
}

export function formatMemory(bytes) {
  if (!Number.isFinite(bytes))
    return null;
  const mib = bytes / 1048576;
  return mib >= 1024 ? `${(mib / 1024).toFixed(1)} GiB` : `${mib.toFixed(1)} MiB`;
}

export function normalizeResourceResponse(payload) {
  if (!payload || payload.ok !== true || !Array.isArray(payload.result?.worktrees))
    throw new Error('Respuesta de recursos inválida de Orca');

  const sessions = new Map();
  for (const worktree of payload.result.worktrees) {
    if (!Array.isArray(worktree?.sessions))
      continue;
    for (const session of worktree.sessions) {
      if (!session?.paneKey)
        continue;
      sessions.set(session.paneKey, {
        pid: Number.isFinite(session.pid) ? session.pid : null,
        cpu: Number.isFinite(session.cpu) ? session.cpu : null,
        memory: Number.isFinite(session.memory) ? session.memory : null,
        collectedAt: Number.isFinite(payload.result.collectedAt)
          ? payload.result.collectedAt
          : null,
        memoryMetric: payload.result.processMemoryMetric ?? null,
      });
    }
  }
  return sessions;
}

export class SessionResourceService {
  constructor(client, ttlMs = DEFAULT_TTL_MS, now = Date.now) {
    this._client = client;
    this._ttlMs = ttlMs;
    this._now = now;
    this._cache = null;
    this._pending = null;
  }

  async get(paneKey) {
    if (!paneKey)
      return null;

    if (this._cache && this._cache.expiresAt > this._now())
      return this._cache.sessions.get(paneKey) ?? null;

    if (!this._pending) {
      this._pending = this._client.fetchResources()
        .then(sessions => {
          this._cache = {
            sessions,
            expiresAt: this._now() + this._ttlMs,
          };
          return sessions;
        })
        .finally(() => {
          this._pending = null;
        });
    }

    return (await this._pending).get(paneKey) ?? null;
  }

  clear() {
    this._cache = null;
  }
}
