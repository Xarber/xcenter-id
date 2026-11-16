import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

export function openRegistry(path) {
  const db = new DatabaseSync(path);
  db.exec(`
    PRAGMA busy_timeout = 3000;
    CREATE TABLE IF NOT EXISTS clients (
      id TEXT PRIMARY KEY, developer TEXT NOT NULL, name TEXT NOT NULL, callback TEXT NOT NULL,
      client TEXT UNIQUE, status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','active','revoked'))
    ) STRICT;
  `);
  const add = db.prepare('INSERT INTO clients (id, developer, name, callback) SELECT ?, ?, ?, ? WHERE (SELECT count(*) FROM clients WHERE developer = ?) < 30');
  const list = db.prepare('SELECT id, name, callback, client, status FROM clients WHERE developer = ? ORDER BY name, id');
  const lookup = db.prepare('SELECT id,name,callback,client,status FROM clients WHERE id=? AND developer=?');
  const active = db.prepare("SELECT 1 FROM clients WHERE client = ? AND status = 'active'");
  const approve = db.prepare("UPDATE clients SET client = ?, status = 'active' WHERE id = ? AND status = 'pending'");
  const revoke = db.prepare("UPDATE clients SET status = 'revoked' WHERE id = ? AND status = 'active'");

  return {
    submit(developer, name, callback) {
      const id = randomUUID();
      return add.run(id, developer, name, callback, developer).changes === 1
        ? { id, name, callback, status: 'pending' }
        : null;
    },
    lookup: (owner,id) => lookup.get(id,owner),
    list: (developer) => list.all(developer),
    published: () => db.prepare("SELECT client,name FROM clients WHERE status='active' ORDER BY name,client LIMIT 200").all(),
    revokeOwned: (owner,id) => db.prepare("UPDATE clients SET status='revoked' WHERE developer=? AND id=? AND status='active'").run(owner,id).changes === 1,
    has: (client) => Boolean(active.get(client)),
    approve: (id, client) => approve.run(client, id).changes === 1,
    revoke: (id) => revoke.run(id).changes === 1,
    close: () => db.close(),
  };
}
