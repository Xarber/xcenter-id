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
  const putTicket=db.prepare('INSERT INTO native_device_handoffs VALUES(?,?,?,?)');
  const takeTicket=db.prepare('DELETE FROM native_device_handoffs WHERE hash=? AND expires>? RETURNING session,code');
  const putBrowser=db.prepare('INSERT INTO native_device_browsers VALUES(?,?,?)');
  const findBrowser=db.prepare('SELECT session FROM native_device_browsers WHERE hash=? AND expires>?');
  const cleanTickets=db.prepare('DELETE FROM native_device_handoffs WHERE expires<=? OR session=?');
  const expireBrowsers=db.prepare('DELETE FROM native_device_browsers WHERE expires<=?');
  return {
    issue(session,code){
      if(!deviceCodePattern.test(code))return null;
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
      putBrowser.run(hash(key),record.session,time+browserLifetime);
      return {code:record.code,key,maxAge:browserLifetime/1000};
    },
    browserSession(key){
      if(typeof key!=='string'||!secretPattern.test(key))return null;
      return findBrowser.get(hash(key),now())?.session??null;
    },
  };
}

export function nativeDeviceEntry(res){
  const nonce=randomBytes(18).toString('base64');
  res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'no-referrer',
    'X-Content-Type-Options':'nosniff',
    'Content-Security-Policy':`default-src 'none'; script-src 'nonce-${nonce}'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'`});
  res.end(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width">
  <title>Review device sign-in · X-Center ID</title><main><h1>Review device sign-in</h1><p id="status" role="status">Opening your request…</p>
  <a href="/device">Enter a code manually</a></main>
  <script nonce="${nonce}">
    const key=location.hash.slice(1);
    history.replaceState(null,'',location.pathname);
    const fail=()=>{document.querySelector('#status').textContent='This request expired. Close this sheet and try again from the app.';};
    if(!/^[A-Za-z0-9_-]{43}$/.test(key))fail();
    else fetch('/account/device/browser/exchange',{method:'POST',headers:{'Content-Type':'application/json','X-AuthNJS-Request':'device-review'},
      body:JSON.stringify({key}),credentials:'same-origin',redirect:'error'}).then(async response=>{
        const data=await response.json();
        if(!response.ok||!/^[A-Z0-9]{6}$/.test(data.code))throw new Error('Unavailable');
        location.replace('/device?code='+data.code);
      }).catch(fail);
  </script></html>`);
}
