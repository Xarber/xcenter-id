import {approvalTarget} from './account-approval.mjs';
import {html} from './oidc.mjs';
import {createHash,randomBytes} from 'node:crypto';

const secretPattern=/^[A-Za-z0-9_-]{43}$/;
export const deviceCodePattern=/^[A-Z0-9]{6}$/;
export const deviceCookie='__Host-authnjs-device';
const secret=()=>randomBytes(32).toString('base64url');
const hash=value=>createHash('sha256').update(value).digest('hex');
const ticketLifetime=60_000;
const browserLifetime=5*60_000;

export function openNativeDeviceHandoff(db,now=Date.now){
  db.exec(`CREATE TABLE IF NOT EXISTS native_device_handoffs(
    hash TEXT PRIMARY KEY,session TEXT NOT NULL REFERENCES account_sessions(hash) ON DELETE CASCADE,
    code TEXT NOT NULL,expires INTEGER NOT NULL
  ) STRICT; CREATE TABLE IF NOT EXISTS native_device_browsers(
    hash TEXT PRIMARY KEY,session TEXT NOT NULL REFERENCES account_sessions(hash) ON DELETE CASCADE,
    expires INTEGER NOT NULL
  ) STRICT;`);
  if(!db.prepare('PRAGMA table_info(native_device_browsers)').all().some(field=>field.name==='target')){
    db.exec('ALTER TABLE native_device_browsers ADD COLUMN target TEXT');
  }
  const putTicket=db.prepare('INSERT INTO native_device_handoffs VALUES(?,?,?,?)');
  const takeTicket=db.prepare('DELETE FROM native_device_handoffs WHERE hash=? AND expires>? RETURNING session,code');
  const putBrowser=db.prepare('INSERT INTO native_device_browsers VALUES(?,?,?,?)');
  const findBrowser=db.prepare('SELECT session FROM native_device_browsers WHERE hash=? AND expires>? AND target IS ?');
  const cleanTickets=db.prepare('DELETE FROM native_device_handoffs WHERE expires<=? OR session=?');
  const expireBrowsers=db.prepare('DELETE FROM native_device_browsers WHERE expires<=?');
  return {
    issue(session,code){
      if(!deviceCodePattern.test(code)&&!approvalTarget(code))return null;
      const key=secret(), time=now();
      cleanTickets.run(time,session);
      putTicket.run(hash(key),session,code,time+ticketLifetime);
      return key;
    },
    exchange(ticket,validSession){
      if(typeof ticket!=='string'||!secretPattern.test(ticket))return null;
      const time=now();
      const record=takeTicket.get(hash(ticket),time);
      if(!record||!validSession(record.session))return null;
      const key=secret();
      expireBrowsers.run(time);
      putBrowser.run(hash(key),record.session,time+browserLifetime,approvalTarget(record.code)?record.code:null);
      return {code:record.code,key,maxAge:browserLifetime/1000};
    },
    browserSession(key,target=null){
      if(typeof key!=='string'||!secretPattern.test(key))return null;
      return findBrowser.get(hash(key),now(),target)?.session??null;
    },
  };
}

export function nativeDeviceEntry(res){
  const nonce=randomBytes(18).toString('base64');
  html(res,`<h1>Review device sign-in</h1><p id="status" role="status">Opening your request…</p>
  <a href="/device">Enter a code manually</a>
  <script nonce="${nonce}">
    const key=location.hash.slice(1);
    history.replaceState(null,'',location.pathname);
    const fail=()=>{document.querySelector('#status').textContent='This request expired. Close this sheet and try again from the app.';};
    if(!/^[A-Za-z0-9_-]{43}$/.test(key))fail();
    else fetch('/account/device/browser/exchange',{method:'POST',headers:{'Content-Type':'application/json','X-AuthNJS-Request':'device-review'},
      body:JSON.stringify({key}),credentials:'same-origin',redirect:'error'}).then(async response=>{
        const data=await response.json();
        if(!response.ok)throw new Error('Unavailable');
        if(/^\\/(?:account-approval|app-approval)\\/[A-Za-z0-9_-]{43}$/.test(data.code))location.replace(data.code);
        else if(/^[A-Z0-9]{6}$/.test(data.code))location.replace('/device?code='+data.code);
        else throw new Error('Unavailable');
      }).catch(fail);
  </script>`,200,'',true,nonce);
}
