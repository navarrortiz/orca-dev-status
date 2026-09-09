import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

test('consulta Orca real a través del cliente GJS', { timeout: 15000 }, async () => {
  const client = pathToFileURL(join(process.cwd(), 'src/orca/client.js'));
  const script = `const loop = imports.gi.GLib.MainLoop.new(null, false);
  (async () => {
    try {
      const { default: OrcaClient } = await import('${client}');
      print(JSON.stringify(await new OrcaClient().fetchStatus()));
    } catch (error) {
      printerr(error.stack ?? error);
      imports.system.exit(1);
    } finally {
      loop.quit();
    }
  })();
  loop.run();`;
  const { stdout } = await execFileAsync('gjs', ['-c', script], {
    timeout: 10000,
    maxBuffer: 5 * 1024 * 1024,
  });
  const snapshot = JSON.parse(stdout);

  assert.equal(snapshot.available, true);
  assert.ok(Array.isArray(snapshot.workspaces));
});
