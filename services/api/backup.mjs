import { backup, DatabaseSync } from 'node:sqlite';
import { mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const [source,target] = process.argv.slice(2);
if (!source || !target) throw new Error('Usage: backup.mjs <state-directory> <new-output-directory>');
process.umask(0o077);
mkdirSync(target,{mode:0o700});
for (const file of readdirSync(source).filter((file) => /^[a-z][a-z-]*\.sqlite$/.test(file))) {
  const db = new DatabaseSync(join(source,file),{readOnly:true});
  try {
    await backup(db,join(target,file));
    const copy = new DatabaseSync(join(target,file),{readOnly:true});
    try {
      if (copy.prepare('PRAGMA quick_check').get().quick_check !== 'ok') throw new Error('Database snapshot failed verification');
    } finally { copy.close(); }
  } finally { db.close(); }
}
