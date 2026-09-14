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
      const client = new OrcaClient();
      print(JSON.stringify({
        status: await client.fetchStatus(),
        resources: [...(await client.fetchResources()).entries()],
      }));
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
  const result = JSON.parse(stdout);

  assert.equal(result.status.available, true);
  assert.ok(Array.isArray(result.status.workspaces));
  assert.ok(Array.isArray(result.resources));
  for (const [paneKey, resources] of result.resources) {
    assert.equal(typeof paneKey, 'string');
    assert.ok(resources.cpu === null || Number.isFinite(resources.cpu));
    assert.ok(resources.memory === null || Number.isFinite(resources.memory));
  }
});
