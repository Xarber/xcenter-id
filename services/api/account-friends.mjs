import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

const digest = value => createHash('sha256').update(value).digest('hex');
const inviteLifetime = 15 * 60_000;
const pair = (first, second) => [first, second].sort();

export function openFriends(database,available=()=>true) {
  const db = new DatabaseSync(database);
  db.exec(`
    PRAGMA busy_timeout=3000;
    CREATE TABLE IF NOT EXISTS friend_invites (
      owner TEXT PRIMARY KEY, digest TEXT UNIQUE NOT NULL, expires INTEGER NOT NULL
    ) STRICT;
    CREATE TABLE IF NOT EXISTS friendships (
      id TEXT UNIQUE NOT NULL, first TEXT NOT NULL, second TEXT NOT NULL,
      created INTEGER NOT NULL, PRIMARY KEY(first,second)
    ) STRICT;
    CREATE INDEX IF NOT EXISTS friendship_second ON friendships(second,first);
  `);
  const saveInvite = db.prepare(`INSERT INTO friend_invites VALUES (?,?,?) ON CONFLICT(owner)
    DO UPDATE SET digest=excluded.digest,expires=excluded.expires`);
  const findInvite = db.prepare('SELECT owner FROM friend_invites WHERE digest=? AND expires>?');
  const removeInvite = db.prepare('DELETE FROM friend_invites WHERE digest=?');
  const link = db.prepare('INSERT INTO friendships VALUES (?,?,?,?) ON CONFLICT(first,second) DO NOTHING');
  const list = db.prepare('SELECT id,first,second,created FROM friendships WHERE first=? OR second=? ORDER BY created DESC');
  const count = db.prepare('SELECT count(*) AS count FROM friendships WHERE first=? OR second=?');
  const match = db.prepare('SELECT id FROM friendships WHERE first=? AND second=?');
  const remove = db.prepare('DELETE FROM friendships WHERE id=? AND (first=? OR second=?)');

  return {
    invite(owner) {
      const code = randomBytes(24).toString('base64url');
      const expires = Date.now()+inviteLifetime;
      saveInvite.run(owner,digest(code),expires);
      return {code,expires};
    },
    accept(owner,code) {
      if (typeof code!=='string' || !/^[A-Za-z0-9_-]{32}$/.test(code)) return false;
      db.exec('BEGIN IMMEDIATE');
      try {
        const hash=digest(code);
        const invite=findInvite.get(hash,Date.now());
        if (!invite || !available(invite.owner) || invite.owner===owner || count.get(owner,owner).count>=100 || count.get(invite.owner,invite.owner).count>=100) {
          db.exec('ROLLBACK');
          return false;
        }
        link.run(randomUUID(),...pair(owner,invite.owner),Date.now());
        removeInvite.run(hash);
        db.exec('COMMIT');
        return true;
      } catch (error) { db.exec('ROLLBACK'); throw error; }
    },
    list: owner => list.all(owner,owner).filter(row=>available(row.first)&&available(row.second)).map(row=>({id:row.id,owner:row.first===owner?row.second:row.first,created:row.created})),
    linked: (owner, friend) => available(owner)&&available(friend)?match.get(...pair(owner,friend))?.id:undefined,
    remove: (owner,id) => remove.run(id,owner,owner).changes===1,
    close: () => db.close(),
  };
}

export function createFriendRoutes({accounts,friends}) {
  const send=(res,status,result)=>res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'}).end(JSON.stringify(result));
  return async (req,res,path)=>{
    const user=accounts.current(req);
    if (!user) return send(res,401,{error:'Sign in to X-Center ID first.'});
    const person=accounts.identity(user.owner);
    if (!person) return send(res,403,{error:'Finish setting up your profile.'});
    if (req.method==='GET'&&path==='/account/friends') {
      const entries=friends.list(user.owner).flatMap(({id,owner,created})=>{
        const username=accounts.username(owner);
        return username?[{id,username,created}]:[];
      });
      return send(res,200,{friends:entries});
    }
    if (!accounts.allowsMutation(req)||req.headers['x-authnjs-request']!=='account-consent'){
      return send(res,403,{error:'Open X-Center ID to change your friends.'});
    }
    if (req.method==='POST'&&path==='/account/friends/invite') return send(res,201,friends.invite(user.owner));
    const removeId=/^\/account\/friends\/([0-9a-f-]{36})$/.exec(path)?.[1];
    if (req.method==='DELETE'&&removeId) {
      friends.remove(user.owner,removeId);
      return send(res,200,{ok:true});
    }
    if (req.method!=='POST'||path!=='/account/friends/accept') return send(res,405,{error:'Method unavailable.'});
    if (!req.headers['content-type']?.startsWith('application/json')) return send(res,415,{error:'JSON required.'});
    const chunks=[];
    let size=0;
    for await (const chunk of req.iterator({destroyOnReturn:false})) {
      size+=chunk.length;
      if(size>1024){req.resume();return send(res,413,{error:'Request too large.'});}
      chunks.push(chunk);
    }
    let code;
    try { code=JSON.parse(Buffer.concat(chunks).toString())?.code; }
    catch { return send(res,422,{error:'Invalid invitation.'}); }
    return friends.accept(user.owner,code)?send(res,200,{ok:true}):send(res,422,{error:'This invitation cannot be accepted.'});
  };
}
