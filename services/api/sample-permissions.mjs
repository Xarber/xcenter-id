import { untilRevoked } from './store.mjs';
const sampleApps = new Map([['places-demo','Places Notebook'],['trips-demo','Trip Planner']]);
export const sampleShared = 'account-shared';
export const sampleNotes = 'sample-notes.v1';
export const sampleFolder = 'sample-shared.v1';

export function createSamplePermissions({ store, accounts, origin }) {
  function json(res,status,value) {
    res.writeHead(status,{'Cache-Control':'no-store','Content-Type':'application/json'});
    res.end(JSON.stringify(value));
  }

  return async (req,res) => {
    const user = accounts.current(req);
    if (!user) return json(res,401,{error:'Sign in to X-Center ID first.'});
    if (req.method === 'GET') {
      const grants = store.listGrants(user.owner);
      const permissions = [];
      for (const [destination,app] of sampleApps) {
        for (const source of [sampleShared,...sampleApps.keys()]) {
          if (source === destination) continue;
          const shared = source === sampleShared;
          const dataset = shared ? sampleFolder : sampleNotes;
          const expires = grants.find((grant) => grant.dataset === dataset &&
            grant.destination === destination && grant.source === source)?.expires ?? null;
          permissions.push({source,destination,app,shared,sourceName:shared ? 'Shared folder' : sampleApps.get(source),expires});
        }
      }
      return json(res,200,{permissions});
    }
    if (req.method !== 'PUT' && req.method !== 'DELETE') return json(res,405,{error:'Method unavailable.'});
    if (req.headers.origin !== origin || req.headers['x-authnjs-request'] !== 'account-consent' ||
      !req.headers['content-type']?.startsWith('application/json')) {
      return json(res,403,{error:'Open Permissions in X-Center ID to change access.'});
    }
    let text = '';
    try {
      for await (const chunk of req.iterator({destroyOnReturn:false})) {
        text += chunk.toString();
        if (text.length > 1024) { req.resume(); return json(res,413,{error:'Request too large.'}); }
      }
      const {source,destination,persistent} = JSON.parse(text);
      if (!sampleApps.has(destination) || (source !== sampleShared && !sampleApps.has(source)) || source === destination) {
        return json(res,422,{error:'Invalid app or folder.'});
      }
      const dataset = source === sampleShared ? sampleFolder : sampleNotes;
      if (req.method === 'PUT') store.grant(user.owner,source,destination,dataset,persistent===true?untilRevoked:Date.now()+3600_000);
      else store.revoke(user.owner,source,destination,dataset);
      return json(res,200,{ok:true});
    } catch { return json(res,400,{error:'Could not change sample permission.'}); }
  };
}
