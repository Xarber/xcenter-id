import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

const digest = value => createHash('sha256').update(value).digest('hex');
const attempts=new Map();
const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
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
    CREATE TABLE IF NOT EXISTS friend_requests (
      id TEXT PRIMARY KEY, sender TEXT NOT NULL, recipient TEXT NOT NULL, created INTEGER NOT NULL,
      UNIQUE(sender,recipient)
    ) STRICT;
    CREATE INDEX IF NOT EXISTS friend_request_recipient ON friend_requests(recipient,created);
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
    removeAccount(owner){
      db.exec('BEGIN IMMEDIATE');
      try{
        db.prepare('DELETE FROM friend_invites WHERE owner=?').run(owner);
        db.prepare('DELETE FROM friendships WHERE first=? OR second=?').run(owner,owner);
        db.prepare('DELETE FROM friend_requests WHERE sender=? OR recipient=?').run(owner,owner);
        db.exec('COMMIT');
      }catch(error){db.exec('ROLLBACK');throw error;}
    },
    invite(owner) {
      const code=Array.from(randomBytes(10),byte=>alphabet[byte%32]).join('');
      const expires = Date.now()+inviteLifetime;
      saveInvite.run(owner,digest(code),expires);
      return {code,expires};
    },
    accept(owner,code) {
      if(typeof code!=='string'||!/^(?:[A-Za-z0-9_-]{32}|[A-Za-z2-9]{10})$/.test(code))return false;
      const now=Date.now();
      for(const [id,state] of attempts)if(state.until<=now)attempts.delete(id);
      const rate=attempts.get(owner)??{count:0,until:now+60_000};
      if(rate.count>=10||(!attempts.has(owner)&&attempts.size>=5000))return false;
      rate.count++;attempts.set(owner,rate);
      if(code.length===10)code=code.toUpperCase();
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
    request(owner,target){
      if(!target||target===owner||!available(target)||match.get(...pair(owner,target)))return;
      const now=Date.now();
      db.prepare('DELETE FROM friend_requests WHERE sender=? AND created<?').run(owner,now-7*86400_000);
      if(db.prepare('SELECT count(*) AS n FROM friend_requests WHERE sender=?').get(owner).n>=30)return;
      db.prepare('INSERT OR IGNORE INTO friend_requests VALUES(?,?,?,?)').run(randomUUID(),owner,target,now);
    },
    pending:owner=>db.prepare('SELECT id,sender FROM friend_requests WHERE recipient=? AND created>? ORDER BY created DESC LIMIT 100').all(owner,Date.now()-7*86400_000).filter(item=>available(item.sender)),
    answer(owner,id,accept){
      db.exec('BEGIN IMMEDIATE');
      try{
        const item=db.prepare('SELECT sender FROM friend_requests WHERE id=? AND recipient=? AND created>?').get(id,owner,Date.now()-7*86400_000);
        if(!item||(accept&&(!available(item.sender)||count.get(owner,owner).count>=100||count.get(item.sender,item.sender).count>=100))){
          db.exec('ROLLBACK');return false;
        }
        if(accept){
          link.run(randomUUID(),...pair(owner,item.sender),Date.now());
          db.prepare('DELETE FROM friend_requests WHERE sender=? AND recipient=?').run(owner,item.sender);
        }
        db.prepare('DELETE FROM friend_requests WHERE id=?').run(id);
        db.exec('COMMIT');return true;
      }catch(error){db.exec('ROLLBACK');throw error;}
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
        return username?[{id,username,created,...accounts.profileBadges?.(owner),avatar:accounts.publicProfileAvatar?.(username)?'/public/profiles/'+username+'/avatar':null}]:[];
      });
      return send(res,200,{friends:entries,requests:friends.pending(user.owner).flatMap(({id,sender})=>{const username=accounts.username(sender);return username?[{id,username,...accounts.profileBadges?.(sender)}]:[];})});
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
    if (req.method!=='POST'||!['/account/friends/accept','/account/friends/request','/account/friends/respond'].includes(path)) return send(res,405,{error:'Method unavailable.'});
    if (!req.headers['content-type']?.startsWith('application/json')) return send(res,415,{error:'JSON required.'});
    const chunks=[];
    let size=0;
    for await (const chunk of req.iterator({destroyOnReturn:false})) {
      size+=chunk.length;
      if(size>1024){req.resume();return send(res,413,{error:'Request too large.'});}
      chunks.push(chunk);
    }
    let input;
    try { input=JSON.parse(Buffer.concat(chunks).toString()); }
    catch { return send(res,422,{error:'Invalid invitation.'}); }
    if(path.endsWith('/request')){
      const name=typeof input?.username==='string'?input.username.trim().toLowerCase():'';
      if(!/^[a-z][a-z0-9]{2,23}$/.test(name))return send(res,422,{error:'Enter a valid username.'});
      friends.request(user.owner,accounts.ownerForUsername(name));
      return send(res,202,{ok:true});
    }
    if(path.endsWith('/respond')){
      return typeof input?.id==='string'&&typeof input.accept==='boolean'&&friends.answer(user.owner,input.id,input.accept)
        ?send(res,200,{ok:true}):send(res,422,{error:'This request is unavailable.'});
    }
    return friends.accept(user.owner,input?.code)?send(res,200,{ok:true}):send(res,422,{error:'This invitation cannot be accepted.'});
  };
}


export function createAppFriendRoutes({accounts,friends,authorize,subject}) {
  return async (req,res)=>{
    const headers={
      'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',
      'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET, OPTIONS','Access-Control-Allow-Headers':'Authorization',
    };
    if(req.method==='OPTIONS')return res.writeHead(204,headers).end();
    if(req.method!=='GET')return res.writeHead(405,{...headers,Allow:'GET, OPTIONS'}).end();
    const token=/^Bearer ([A-Za-z0-9_-]{20,200})$/.exec(req.headers.authorization??'')?.[1];
    const access=token&&await authorize(token);
    if(!access)return res.writeHead(401,headers).end(JSON.stringify({error:'A user access token with friends permission is required.'}));
    const entries=friends.list(access.owner).flatMap(({owner})=>{
      const username=accounts.username(owner);
      return username?[{username,sub:subject(owner,access.client)}]:[];
    });
    return res.writeHead(200,headers).end(JSON.stringify({friends:entries}));
  };
}
