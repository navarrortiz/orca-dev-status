import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

import { normalizeOrcaResponse } from './status-model.js';

Gio._promisify(
  Gio.Subprocess.prototype,
  'communicate_utf8_async',
  'communicate_utf8_finish',
);

const TIMEOUT_MS = 4000;
const OPEN_TIMEOUT_MS = 15000;
const CLOSE_TIMEOUT_MS = 8000;

function findCli() {
  const fromPath = GLib.find_program_in_path('orca-ide');
  if (fromPath)
    return fromPath;

  const localPath = GLib.build_filenamev([
    GLib.get_home_dir(),
    '.local',
    'bin',
    'orca-ide',
  ]);
  return GLib.file_test(localPath, GLib.FileTest.EXISTS) ? localPath : null;
}

export default class OrcaClient {
  constructor() {
    this._operations = new Set();
    this._firstPrompts = new Map();
  }

  async _run(args, timeoutMs = TIMEOUT_MS) {
    const cli = findCli();
    if (!cli)
      throw new Error('No se encontró orca-ide');

    const operation = {
      cancellable: new Gio.Cancellable(),
      process: Gio.Subprocess.new(
        [cli, ...args],
        Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE,
      ),
    };
    this._operations.add(operation);
    let timeoutId = 0;

    try {
      timeoutId = GLib.timeout_add(
        GLib.PRIORITY_DEFAULT,
        timeoutMs,
        () => {
          operation.cancellable.cancel();
          return GLib.SOURCE_REMOVE;
        },
      );
      const [stdout, stderr] = await operation.process.communicate_utf8_async(
        null,
        operation.cancellable,
      );
      if (!operation.process.get_successful())
        throw new Error(stderr?.trim() || 'Orca devolvió un error');
      return JSON.parse(stdout);
    } finally {
      if (timeoutId && GLib.MainContext.default().find_source_by_id(timeoutId))
        GLib.source_remove(timeoutId);
      this._operations.delete(operation);
    }
  }

  async fetchStatus() {
    return normalizeOrcaResponse(
      await this._run(['worktree', 'ps', '--json']),
      this._firstPrompts,
    );
  }

  async open() {
    await this._run(['open', '--json'], OPEN_TIMEOUT_MS);
  }

  async _terminalHandle(worktreeId, paneKey) {
    if (!worktreeId || !paneKey)
      throw new Error('La sesión no tiene un identificador válido');

    const [tabId, leafId] = paneKey.split(':');
    const payload = await this._run([
      'terminal', 'list', '--worktree', `id:${worktreeId}`, '--json',
    ]);
    const terminal = payload.result?.terminals?.find(item =>
      item.tabId === tabId && item.leafId === leafId);
    if (!terminal?.handle)
      throw new Error('La sesión ya no está disponible');

    return terminal.handle;
  }

  async switchAgent(worktreeId, paneKey) {
    await this.open();
    const handle = await this._terminalHandle(worktreeId, paneKey);
    await this._run(['terminal', 'switch', '--terminal', handle, '--json']);
  }

  async closeAgent(worktreeId, paneKey) {
    const handle = await this._terminalHandle(worktreeId, paneKey);
    await this._run([
      'terminal', 'close', '--terminal', handle, '--json',
    ], CLOSE_TIMEOUT_MS);
  }

  cancel() {
    for (const { cancellable, process } of this._operations) {
      cancellable.cancel();
      process.force_exit();
    }
  }
}
