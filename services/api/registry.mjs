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
    CREATE TABLE IF NOT EXISTS client_brand(id TEXT PRIMARY KEY,developer_name TEXT NOT NULL,icon TEXT)
      STRICT;
    CREATE TABLE IF NOT EXISTS client_native(id TEXT PRIMARY KEY) STRICT;
  `);
  const add = db.prepare('INSERT INTO clients (id, developer, name, callback) SELECT ?, ?, ?, ? WHERE (SELECT count(*) FROM clients WHERE developer = ?) < 30');
  const list = db.prepare(`SELECT c.id,c.name,c.callback,c.client,c.status,b.developer_name AS developerName,b.icon,EXISTS(SELECT 1 FROM client_native n WHERE n.id=c.id) AS native FROM clients c
    LEFT JOIN client_brand b ON b.id=c.id WHERE c.developer=? ORDER BY c.name,c.id`);
  const lookup = db.prepare('SELECT c.*,EXISTS(SELECT 1 FROM client_native n WHERE n.id=c.id) AS native FROM clients c WHERE id=? AND developer=?');
  const active = db.prepare("SELECT 1 FROM clients WHERE client = ? AND status = 'active'");
  const approve = db.prepare("UPDATE clients SET client = ?, status = 'active' WHERE id = ? AND status = 'pending'");
  const revoke = db.prepare("UPDATE clients SET status = 'revoked' WHERE id = ? AND status = 'active'");

  const setBrand=db.prepare(`INSERT INTO client_brand VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET
    developer_name=excluded.developer_name,icon=excluded.icon`);
  return {
    brand: (client) => db.prepare(`SELECT c.developer AS owner,b.developer_name AS developerName,b.icon
      FROM clients c LEFT JOIN client_brand b ON b.id=c.id WHERE c.client=? AND c.status='active'`).get(client),
    updateBrand(owner,id,brand) {
      const item=lookup.get(id,owner);
      if(!item||item.status==='revoked')return false;
      setBrand.run(id,brand.developerName,brand.icon);
      return true;
    },
    submit(developer, name, callback, brand, native = false) {
      const id = randomUUID();
      db.exec('BEGIN IMMEDIATE');
      try {
        if(!add.run(id,developer,name,callback,developer).changes){db.exec('COMMIT');return null;}
        if(brand)setBrand.run(id,brand.developerName,brand.icon);
        if(native)db.prepare('INSERT INTO client_native VALUES(?)').run(id);
        db.exec('COMMIT');
        return {id,name,callback,status:'pending',...brand,...(native?{native:true}:{})};
      } catch(error){db.exec('ROLLBACK');throw error;}
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
