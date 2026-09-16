const EFFORTS = new Set([
  'minimal',
  'low',
  'medium',
  'high',
  'xhigh',
  'max',
  'ultra',
]);

export function normalizeTerminalScreenDetails(payload) {
  const lines = payload?.result?.terminal?.tail;
  if (!payload?.ok || !Array.isArray(lines))
    return { model: null, effort: null };

  for (let index = lines.length - 1; index >= 0; index--) {
    const line = String(lines[index]);
    if (!line.includes('·'))
      continue;
    const identity = line.split('·', 1)[0].trim().split(/\s+/);
    const effort = identity.at(-1)?.toLowerCase();
    if (identity.length >= 2 && EFFORTS.has(effort)) {
      return {
        model: identity.slice(0, -1).join(' '),
        effort,
      };
    }
  }

  return { model: null, effort: null };
}
