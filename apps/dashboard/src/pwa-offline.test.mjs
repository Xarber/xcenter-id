import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';

test('offline worker falls back for account pages without caching authenticated responses', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'xcenter-pwa-'));
  try {
    writeFileSync(join(directory,'index.html'), '<html><head></head><body></body></html>');
    copyFileSync(new URL('../public/offline.html', import.meta.url), join(directory,'offline.html'));
    execFileSync(process.execPath, [fileURLToPath(new URL('../scripts/prepare-web.mjs', import.meta.url)), directory]);

    const listeners = new Map();
    const origin = 'https://identity.example.test';
    const offlinePage = new Response('Offline fallback');
    const publicShell = new Response('Public app shell');
    let online = false;
    runInNewContext(readFileSync(join(directory, 'service-worker.js'), 'utf8'), {
      URL, Response,
      self:{location:{origin}, addEventListener:(event,handler)=>listeners.set(event,handler)},
      fetch: async () => {
        if (!online) throw new TypeError('Network unavailable');
        return new Response('Online account page');
      },
      caches:{open:async()=>({match:async path=>path==='/offline.html'?offlinePage:path==='/'?publicShell:undefined})},
    });

    function navigate(path, mode='navigate', method='GET') {
      let response;
      listeners.get('fetch')({
        request:{url:new URL(path,origin).href,method,mode},
        respondWith:value=>{ response=value; },
      });
      return response;
    }

    assert.equal(await navigate('/permissions/xid-test?view=detail'), offlinePage);
    assert.equal(await navigate('/docs/sdk/upload-file'), publicShell);
    assert.equal(await (await navigate('/profile')).text(), 'Offline fallback');
    assert.equal(navigate('/profile','cors'), undefined);
    assert.equal(navigate('/profile','navigate','POST'), undefined);
    assert.equal(navigate('/account/me'), undefined);
    assert.equal(navigate('/interaction/consent'), undefined);
    assert.equal(navigate('https://other.example.test/profile'), undefined);
    online = true;
    assert.equal(await (await navigate('/profile')).text(), 'Online account page');
  } finally {
    rmSync(directory, { recursive:true, force:true });
  }
});
