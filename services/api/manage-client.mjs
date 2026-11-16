import { realpathSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { openRegistry } from './registry.mjs';

const [action, id, client] = process.argv.slice(2);
const directory = process.env.AUTHNJS_DATA_DIR;
if (!directory || !/^[0-9a-f-]{36}$/.test(id ?? '') ||
    !((action === 'approve' && /^[A-Za-z0-9._-]{1,128}$/.test(client ?? '')) ||
      (action === 'revoke' && client === undefined))) {
  throw new Error('Usage: manage-client.mjs approve <registration UUID> <issuer client ID> or revoke <registration UUID>');
}
const path = realpathSync(join(directory, 'authnjs.sqlite'));
if (!statSync(path).isFile()) throw new Error('Expected an existing API database');
const registry = openRegistry(path);
try {
  const changed = action === 'approve' ? registry.approve(id, client) : registry.revoke(id);
  if (!changed) throw new Error('No eligible registration was changed');
  console.log('Registration updated.');
} finally {
  registry.close();
}
