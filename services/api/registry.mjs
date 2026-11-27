import {matchAdminQuery} from './admin-search.mjs';
import { createHash,randomUUID } from 'node:crypto';
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
    CREATE TABLE IF NOT EXISTS app_restrictions(id TEXT PRIMARY KEY, restricted INTEGER NOT NULL) STRICT;
    CREATE TABLE IF NOT EXISTS app_protected_storage_support(id TEXT PRIMARY KEY) STRICT;
    CREATE TABLE IF NOT EXISTS app_administration_trust(id TEXT PRIMARY KEY) STRICT;
    CREATE TABLE IF NOT EXISTS app_peer_policy (
      id TEXT PRIMARY KEY,enabled INTEGER NOT NULL,discovery INTEGER NOT NULL,generation INTEGER NOT NULL DEFAULT 1
    ) STRICT;
    CREATE TABLE IF NOT EXISTS client_native(id TEXT PRIMARY KEY) STRICT;
    CREATE TABLE IF NOT EXISTS app_profiles(id TEXT PRIMARY KEY, description TEXT NOT NULL, repository TEXT NOT NULL, callbacks TEXT NOT NULL, verified INTEGER NOT NULL DEFAULT 0) STRICT;
    CREATE TABLE IF NOT EXISTS app_callback_approvals(id TEXT PRIMARY KEY, callbacks TEXT NOT NULL) STRICT;
    CREATE TABLE IF NOT EXISTS app_requirements(id TEXT PRIMARY KEY, email INTEGER NOT NULL, age_range INTEGER NOT NULL) STRICT;
    CREATE TABLE IF NOT EXISTS app_local_registrations(id TEXT PRIMARY KEY) STRICT;
    CREATE TABLE IF NOT EXISTS app_reader_trust(id TEXT PRIMARY KEY,mode TEXT NOT NULL CHECK(mode IN ('any','secure','verified'))) STRICT;
    CREATE TABLE IF NOT EXISTS app_access_policy (
      id TEXT PRIMARY KEY, private INTEGER NOT NULL, requests INTEGER NOT NULL DEFAULT 0
    ) STRICT;
    CREATE TABLE IF NOT EXISTS app_access_members (
      id TEXT NOT NULL, account TEXT NOT NULL, approved INTEGER NOT NULL, PRIMARY KEY(id,account)
    ) STRICT;
    CREATE TABLE IF NOT EXISTS developer_github_profiles(owner TEXT PRIMARY KEY, url TEXT NOT NULL) STRICT;
    CREATE TABLE IF NOT EXISTS developer_profiles(owner TEXT PRIMARY KEY,name TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'unverified') STRICT;
  `);
  if(!db.prepare('PRAGMA table_info(app_peer_policy)').all().some(column=>column.name==='generation')){
    db.exec('ALTER TABLE app_peer_policy ADD COLUMN generation INTEGER NOT NULL DEFAULT 1');
  }
  const trustedApp=db.prepare('SELECT 1 FROM app_administration_trust WHERE id=?');
  const add = db.prepare("INSERT INTO clients (id, developer, name, callback) SELECT ?, ?, ?, ? WHERE (SELECT count(*) FROM clients WHERE developer = ? AND status <> 'revoked') < 30");
  const list = db.prepare(`SELECT c.id,c.name,c.callback,c.client,c.status,b.developer_name AS developerName,b.icon,p.description,p.repository,p.callbacks,p.verified,EXISTS(SELECT 1 FROM client_native n WHERE n.id=c.id) AS native FROM clients c
    LEFT JOIN client_brand b ON b.id=c.id LEFT JOIN app_profiles p ON p.id=c.id WHERE c.developer=? ORDER BY c.name,c.id`);
  const lookup = db.prepare('SELECT c.*,p.description,p.repository,p.callbacks,p.verified,EXISTS(SELECT 1 FROM client_native n WHERE n.id=c.id) AS native FROM clients c LEFT JOIN app_profiles p ON p.id=c.id WHERE c.id=? AND c.developer=?');
  const storedIcon=db.prepare('SELECT icon FROM client_brand WHERE id=?');
  const active = db.prepare("SELECT 1 FROM clients WHERE client = ? AND status = 'active' AND id NOT IN (SELECT id FROM app_restrictions WHERE restricted=1)");
  const approve = db.prepare("UPDATE clients SET client = ?, status = 'active' WHERE id = ? AND status = 'pending'");
  const revoke = db.prepare("UPDATE clients SET status = 'revoked' WHERE id = ? AND status IN ('pending','active')");

  const setBrand=db.prepare(`INSERT INTO client_brand VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET
    developer_name=excluded.developer_name,icon=excluded.icon`);
  const readRequirements=db.prepare("SELECT email,age_range FROM app_requirements WHERE id=?");
  const isLocal=db.prepare("SELECT 1 FROM app_local_registrations WHERE id=?");
  const reviewed=db.prepare('SELECT callbacks FROM app_callback_approvals WHERE id=?');
  const matchesReview=(id,callbacks)=>reviewed.get(id)?.callbacks===JSON.stringify(callbacks);
  const iconPath=(id,icon)=>'/public/app-icons/'+id+'?v='+createHash('sha256').update(icon).digest('hex').slice(0,16);
  const appView=row=>row?{...row,...(row.status==='active'&&row.icon?{iconUrl:iconPath(row.id,row.icon)}:{}),description:row.description??'',repository:row.repository??'',
    callbacks:row.callbacks?JSON.parse(row.callbacks):[row.callback],verified:!!row.verified,...(row.id?{requirements:requirements(row.id),local:!!isLocal.get(row.id),callbackApproved:row.status==='pending'&&matchesReview(row.id,row.callbacks?JSON.parse(row.callbacks):[row.callback])}:{})}:undefined;
  const requirements=id=>{const row=readRequirements.get(id);return {email:!!row?.email,age_range:!!row?.age_range};};
  const detailByClient=db.prepare(`SELECT c.id,c.name,c.callback,p.callbacks FROM clients c LEFT JOIN app_profiles p ON p.id=c.id
    WHERE c.client=? AND c.status='active' AND c.id NOT IN (SELECT id FROM app_restrictions WHERE restricted=1)`);
  const removeAdministration=db.prepare('DELETE FROM app_administration_trust WHERE id=?');
  const writeAppProfile=db.prepare(`INSERT INTO app_profiles(id,description,repository,callbacks) VALUES(?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET description=excluded.description,repository=excluded.repository,callbacks=excluded.callbacks,verified=0`);
  const readDeveloper=db.prepare('SELECT name,status FROM developer_profiles WHERE owner=?');
  const readOpenSource=db.prepare(`SELECT p.repository FROM app_profiles p JOIN clients c ON c.id=p.id
    WHERE c.developer=? AND c.status='active' AND p.repository<>'' LIMIT 1`);
  const githubProfile=db.prepare('SELECT url FROM developer_github_profiles WHERE owner=?');
  const registeredDeveloper=db.prepare("SELECT 1 FROM clients WHERE developer=? AND status<>'revoked' LIMIT 1");
  const hasDeveloper=owner=>!!(readDeveloper.get(owner)||registeredDeveloper.get(owner));
  const developerView=owner=>({...readDeveloper.get(owner)??{name:'',status:'unverified'},githubProfile:githubProfile.get(owner)?.url??''});
  const setAppName=db.prepare('UPDATE clients SET name=?,callback=? WHERE id=? AND developer=?');
  function saveProfile(owner,id,profile){
    if(!matchesReview(id,profile.callbacks))db.prepare('DELETE FROM app_callback_approvals WHERE id=?').run(id);
    setAppName.run(profile.name,profile.callbacks[0],id,owner);
    const oldBrand=db.prepare('SELECT developer_name FROM client_brand WHERE id=?').get(id);
    setBrand.run(id,oldBrand?.developer_name??'',profile.icon);
    removeAdministration.run(id);
    writeAppProfile.run(id,profile.description,profile.repository,JSON.stringify(profile.callbacks));
  }
  const accessByClient=db.prepare("SELECT c.id,c.developer,p.private,p.requests FROM clients c LEFT JOIN app_access_policy p ON p.id=c.id WHERE c.client=? AND c.status='active'");
  const membership=db.prepare('SELECT approved FROM app_access_members WHERE id=? AND account=?');
  const access=(owner,client)=>{
    const policy=accessByClient.get(client);
    const allowed=!policy?.private||policy.developer===owner||membership.get(policy.id,owner)?.approved===1;
    return {allowed,canRequest:!allowed&&!!policy.requests,pending:!allowed&&membership.get(policy.id,owner)?.approved===0};
  };
  return {
    removeAccount(owner){
      db.exec('BEGIN IMMEDIATE');
      try{
        db.prepare("UPDATE clients SET status='revoked' WHERE developer=?").run(owner);
        for(const table of ['developer_profiles','developer_github_profiles'])db.prepare('DELETE FROM '+table+' WHERE owner=?').run(owner);
        db.prepare('DELETE FROM app_access_members WHERE account=? OR id IN (SELECT id FROM clients WHERE developer=?)').run(owner,owner);
        db.exec('COMMIT');
      }catch(error){db.exec('ROLLBACK');throw error;}
    },
    access,
    readerTrust(id){return db.prepare('SELECT mode FROM app_reader_trust WHERE id=?').get(id)?.mode??'secure';},
    setReaderTrust(owner,id,mode){
      if(lookup.get(id,owner)?.status==='revoked'||!lookup.get(id,owner))return false;
      db.prepare('INSERT INTO app_reader_trust VALUES(?,?) ON CONFLICT(id) DO UPDATE SET mode=excluded.mode').run(id,mode);
      return true;
    },
    crossReadAllowed(source,destination){
      const from=accessByClient.get(source),to=accessByClient.get(destination);
      if(!from||!to||!active.get(source)||!active.get(destination))return false;
      const mode=this.readerTrust(from.id);
      if(mode==='any')return true;
      if(isLocal.get(to.id))return false;
      return mode==='secure'||!!db.prepare('SELECT verified FROM app_profiles WHERE id=?').get(to.id)?.verified;
    },
    accessSettings(owner,id){
      const app=lookup.get(id,owner);
      if(!app||app.status==='revoked')return null;
      const policy=db.prepare('SELECT private,requests FROM app_access_policy WHERE id=?').get(id);
      return {private:!!policy?.private,requests:!!policy?.requests,
        members:db.prepare('SELECT account,approved FROM app_access_members WHERE id=? ORDER BY approved DESC,account').all(id)};
    },
    saveAccess(owner,id,change){
      const app=lookup.get(id,owner);
      if(!app||app.status==='revoked')return false;
      if(change.action==='settings'){
        db.prepare('INSERT INTO app_access_policy VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET private=excluded.private,requests=excluded.requests')
          .run(id,Number(change.private),Number(change.private&&change.requests));
      }else if(change.action==='approve'){
        const prior=membership.get(id,change.account);
        if(!prior&&db.prepare('SELECT count(*) AS total FROM app_access_members WHERE id=?').get(id).total>=500)return false;
        db.prepare('INSERT INTO app_access_members VALUES(?,?,1) ON CONFLICT(id,account) DO UPDATE SET approved=1').run(id,change.account);
      }else return db.prepare('DELETE FROM app_access_members WHERE id=? AND account=?').run(id,change.account).changes===1;
      return true;
    },
    requestAccess(owner,client){
      if(!access(owner,client).canRequest)return false;
      const {id}=accessByClient.get(client);
      return !!db.prepare('INSERT OR IGNORE INTO app_access_members SELECT ?,?,0 WHERE (SELECT count(*) FROM app_access_members WHERE id=?) < 500')
        .run(id,owner,id).changes||membership.get(id,owner)?.approved===0;
    },
    trustedAdministration(client){
      const app=detailByClient.get(client);
      return !!app&&!isLocal.get(app.id)&&!!db.prepare('SELECT verified FROM app_profiles WHERE id=?').get(app.id)?.verified&&!!trustedApp.get(app.id);
    },
    setAdministrationTrust(id,enabled){
      const app=db.prepare(`SELECT c.client,c.status,p.verified FROM clients c
        LEFT JOIN app_profiles p ON c.id=p.id WHERE c.id=?`).get(id);
      if(!app)return false;
      if(!enabled){
        db.prepare('DELETE FROM app_administration_trust WHERE id=?').run(id);
        return true;
      }
      if(app.status!=='active'||!app.verified||!detailByClient.get(app.client)||isLocal.get(id))return false;
      db.prepare('INSERT OR IGNORE INTO app_administration_trust VALUES(?)').run(id);
      return true;
    },
    supportsProtectedStorage(client){
      const app=detailByClient.get(client);
      return !!app&&!isLocal.get(app.id)&&!!db.prepare('SELECT 1 FROM app_protected_storage_support WHERE id=?').get(app.id);
    },
    setProtectedStorageSupport(owner,id,enabled){
      const app=lookup.get(id,owner);
      if(typeof enabled!=='boolean'||app?.status!=='active'||!detailByClient.get(app.client)||isLocal.get(id))return false;
      if(enabled)db.prepare('INSERT OR IGNORE INTO app_protected_storage_support VALUES(?)').run(id);
      else db.prepare('DELETE FROM app_protected_storage_support WHERE id=?').run(id);
      return true;
    },
    peerPolicy(client){
      const app=detailByClient.get(client);
      if(!app||!db.prepare('SELECT verified FROM app_profiles WHERE id=?').get(app.id)?.verified)return null;
      const policy=db.prepare('SELECT enabled,discovery,generation FROM app_peer_policy WHERE id=?').get(app.id);
      return {enabled:!!policy?.enabled,discovery:!!policy?.enabled&&!!policy.discovery,generation:policy?.generation??0};
    },
    ownedPeerPolicy(owner,id,change){
      const app=lookup.get(id,owner);
      if(!app||app.status!=='active'||!this.peerPolicy(app.client))return null;
      if(change)db.prepare(`INSERT INTO app_peer_policy(id,enabled,discovery) VALUES(?,?,?) ON CONFLICT(id)
        DO UPDATE SET enabled=excluded.enabled,discovery=excluded.discovery,
        generation=app_peer_policy.generation+(app_peer_policy.enabled<>excluded.enabled)`)
        .run(id,Number(change.enabled),Number(change.enabled&&change.discovery));
      return this.peerPolicy(app.client);
    },
    registration:id=>db.prepare('SELECT c.id,c.client,c.developer,c.status,p.verified FROM clients c LEFT JOIN app_profiles p ON p.id=c.id WHERE c.id=?').get(id),
    clientForId:id=>db.prepare('SELECT client FROM clients WHERE id=?').get(id)?.client,
    icon:id=>db.prepare(`SELECT b.icon FROM client_brand b JOIN clients c USING(id) WHERE c.id=? AND c.status='active' AND c.id NOT IN (SELECT id FROM app_restrictions WHERE restricted=1)`).get(id)?.icon,
    brand: (client) => db.prepare(`SELECT c.id,c.developer AS owner,c.name,coalesce(nullif(d.name,''),b.developer_name) AS developerName,
      b.icon,p.description,p.repository,p.verified,EXISTS(SELECT 1 FROM app_local_registrations l WHERE l.id=c.id) AS local,d.status AS developerStatus,r.email AS requiresEmail,r.age_range AS requiresAgeRange
      FROM clients c LEFT JOIN client_brand b ON b.id=c.id LEFT JOIN app_profiles p ON p.id=c.id
      LEFT JOIN developer_profiles d ON d.owner=c.developer LEFT JOIN app_requirements r ON r.id=c.id WHERE c.client=? AND c.status='active' AND c.id NOT IN (SELECT id FROM app_restrictions WHERE restricted=1)`).all(client)
      .map(row=>({...row,iconUrl:row.icon?iconPath(row.id,row.icon):null}))[0],
    publicDetails: client=>appView(detailByClient.get(client)),
    developer: developerView, hasDeveloper,
    saveRequirements(owner,id,input){
      const app=lookup.get(id,owner);
      if(!app||app.status==='revoked')return null;
      db.prepare('INSERT INTO app_requirements VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET email=excluded.email,age_range=excluded.age_range')
        .run(id,Number(input.email),Number(input.age_range));
      return requirements(id);
    },
    saveDeveloper(owner,name,request,github){
      db.exec('BEGIN IMMEDIATE');
      try{
      const previous=developerView(owner);
      if(request&&(!readOpenSource.get(owner)||!name)){db.exec('ROLLBACK');return null;}
      const url=github??previous.githubProfile;
      const changed=previous.name!==name||previous.githubProfile!==url;
      const status=request&&(previous.status!=='verified'||changed)?'requested':changed?'unverified':previous.status;
      db.prepare(`INSERT INTO developer_profiles VALUES(?,?,?) ON CONFLICT(owner) DO UPDATE SET name=excluded.name,status=excluded.status`).run(owner,name,status);
      db.prepare('INSERT INTO developer_github_profiles VALUES(?,?) ON CONFLICT(owner) DO UPDATE SET url=excluded.url').run(owner,url);
      const result=developerView(owner);
      db.exec('COMMIT');
      return result;
      }catch(error){db.exec('ROLLBACK');throw error;}
    },
    attachStorage(path){
      db.prepare('ATTACH DATABASE ? AS hosted_config').run(path);
    },
    saveConfiguration(owner,id,configuration,storageChange){
      const previous=this.lookupWithBrand(owner,id);
      if(!previous||previous.status==='revoked')return false;
      const {profile,requirements,access}=configuration;
      if(previous.status!=='pending'&&new URL(previous.callback).origin!==new URL(profile.callbacks[0]).origin)return false;
      db.exec('BEGIN IMMEDIATE');
      try{
        const profileChanged=['name','description','repository','icon'].some(key=>(previous[key]??null)!==profile[key])||
          JSON.stringify(previous.callbacks)!==JSON.stringify(profile.callbacks);
        if(profileChanged)saveProfile(owner,id,profile);
        this.saveRequirements(owner,id,requirements);
        this.saveAccess(owner,id,{action:'settings',private:access.private,requests:access.allowRequests});
        this.setReaderTrust(owner,id,access.readerTrust);
        storageChange?.(db,'hosted_config');
        db.exec('COMMIT');
        return true;
      }catch(error){db.exec('ROLLBACK');throw error;}
    },
    saveApp(owner,id,profile){
      const previous=appView(lookup.get(id,owner));
      if(!previous||previous.status==='revoked')return null;
      if(previous.status!=='pending'&&new URL(previous.callback).origin!==new URL(profile.callbacks[0]).origin)return null;
      db.exec('BEGIN IMMEDIATE');
      try{
        saveProfile(owner,id,profile);
        db.exec('COMMIT');
        return {...appView(lookup.get(id,owner)),icon:profile.icon};
      }catch(error){db.exec('ROLLBACK');throw error;}
    },
    approveCallbacks(id,callbacks){
      const row=db.prepare("SELECT c.callback,p.callbacks FROM clients c LEFT JOIN app_profiles p USING(id) WHERE c.id=? AND c.status='pending'").get(id);
      if(!row||isLocal.get(id)||!Array.isArray(callbacks))return false;
      const exact=row.callbacks?JSON.parse(row.callbacks):[row.callback];
      if(JSON.stringify(callbacks)!==JSON.stringify(exact)||!exact.every(value=>{
        try {
          const url=new URL(value);
          return url.protocol==='https:'&&!url.username&&!url.password&&!url.search&&!url.hash&&url.pathname!=='/';
        } catch {return false;}
      }))return false;
      return !!db.prepare('INSERT INTO app_callback_approvals VALUES(?,?) ON CONFLICT(id) DO UPDATE SET callbacks=excluded.callbacks').run(id,JSON.stringify(exact)).changes;
    },
    revokeCallbackApproval(id){
      return !!db.prepare('DELETE FROM app_callback_approvals WHERE id=?').run(id).changes;
    },
    activateRegistration(application,client){
      db.exec('BEGIN IMMEDIATE');
      try {
        const latest=this.lookup(application.developer,application.id);
        if(latest?.status!=='pending'||JSON.stringify(latest.callbacks)!==JSON.stringify(application.callbacks)||
            (application.callbackApproved&&!latest.callbackApproved)){
          db.exec('ROLLBACK');
          return false;
        }
        const activated=approve.run(client,application.id).changes===1;
        if(activated)db.prepare('DELETE FROM app_callback_approvals WHERE id=?').run(application.id);
        db.exec('COMMIT');
        return activated;
      } catch(error){ db.exec('ROLLBACK');throw error; }
    },
    searchAdminApps(query,usernameForOwner){
      return db.prepare(`SELECT c.id,c.client,c.developer,c.name,c.status,c.callback,p.repository,
        coalesce(nullif(d.name,''),b.developer_name) AS developerName FROM clients c
        LEFT JOIN app_profiles p ON c.id=p.id LEFT JOIN client_brand b ON c.id=b.id
        LEFT JOIN developer_profiles d ON d.owner=c.developer WHERE c.status<>'revoked'
        ORDER BY c.name,c.id`).all()
        .filter(item=>matchAdminQuery(query,item.name,item.client,item.callback,item.repository,item.developerName))
        .map(item=>({id:item.id,title:item.name,description:item.developerName||item.status,username:usernameForOwner(item.developer)}));
    },
    searchAdminDevelopers(query,usernameForOwner){
      return db.prepare(`WITH developer_owners(owner) AS (
        SELECT owner FROM developer_profiles UNION SELECT developer FROM clients WHERE status<>'revoked'
      ) SELECT o.owner,d.name,g.url,d.status FROM developer_owners o LEFT JOIN developer_profiles d ON d.owner=o.owner
        LEFT JOIN developer_github_profiles g ON g.owner=o.owner ORDER BY d.name,o.owner`).all()
        .map(item=>({...item,username:usernameForOwner(item.owner)}))
        .filter(item=>matchAdminQuery(query,item.name,item.url,item.username,item.status))
        .map(item=>({id:item.owner,title:item.name||item.username||'Developer',description:item.status??'unverified',username:item.username}));
    },
    administration:()=>({
      apps:db.prepare(`SELECT c.id,c.name,c.callback,c.status,p.description,p.repository,p.callbacks,p.verified,b.icon,d.name AS developerName
        FROM clients c LEFT JOIN app_profiles p ON p.id=c.id LEFT JOIN client_brand b ON b.id=c.id LEFT JOIN developer_profiles d ON d.owner=c.developer
        ORDER BY c.status,c.name LIMIT 300`).all().map(app=>({...appView(app),icon:app.status==='active'&&app.icon?iconPath(app.id,app.icon):app.icon,verified:!!app.verified,local:!!isLocal.get(app.id),administration:!!trustedApp.get(app.id)})),
      developers:db.prepare(`WITH developer_owners(owner) AS (
          SELECT owner FROM developer_profiles UNION SELECT developer FROM clients WHERE status<>'revoked'
        )
        SELECT o.owner,coalesce(nullif(d.name,''),(
          SELECT nullif(b.developer_name,'') FROM clients c JOIN client_brand b ON b.id=c.id
          WHERE c.developer=o.owner AND c.status<>'revoked' AND trim(b.developer_name)<>'' ORDER BY c.rowid DESC LIMIT 1
        ),'') AS name,coalesce(d.status,'unverified') AS status
        FROM developer_owners o LEFT JOIN developer_profiles d ON d.owner=o.owner
        ORDER BY (d.status='requested') DESC, name, o.owner LIMIT 300`).all()
        .map(developer=>({...developer,repository:readOpenSource.get(developer.owner)?.repository??null,githubProfile:githubProfile.get(developer.owner)?.url??null})),
    }),
    verifyApp(id,verified){
      if(verified&&isLocal.get(id))return false;
      const item=db.prepare("SELECT callback FROM clients WHERE id=? AND status IN ('pending','active')").get(id);
      if(!item)return false;
      if(!verified)db.prepare('DELETE FROM app_administration_trust WHERE id=?').run(id);
      db.prepare(`INSERT INTO app_profiles VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET verified=excluded.verified`)
        .run(id,'','',JSON.stringify([item.callback]),Number(verified));
      return true;
    },
    verifyDeveloper(owner,verified,fallback=''){
      const previous=developerView(owner);
      if(!verified)return db.prepare("UPDATE developer_profiles SET status='unverified' WHERE owner=? AND status='verified'").run(owner).changes===1;
      if(!hasDeveloper(owner))return false;
      return db.prepare(`INSERT INTO developer_profiles VALUES(?,?,'verified') ON CONFLICT(owner) DO UPDATE SET status='verified'`)
        .run(owner,previous.name||fallback).changes===1;
    },
    updateBrand(owner,id,brand) {
      const item=lookup.get(id,owner);
      if(!item||item.status==='revoked')return false;
      setBrand.run(id,brand.developerName,brand.icon);
      db.prepare('UPDATE app_profiles SET verified=0 WHERE id=?').run(id);
      removeAdministration.run(id);
      return true;
    },
    submit(developer, name, callback, brand, native = false, profile, local = false) {
      const id = randomUUID();
      db.exec('BEGIN IMMEDIATE');
      try {
        if(!add.run(id,developer,name,callback,developer).changes){db.exec('COMMIT');return null;}
        if(brand)setBrand.run(id,brand.developerName,brand.icon);
        if(profile)writeAppProfile.run(id,profile.description,profile.repository,JSON.stringify(profile.callbacks));
        if(native)db.prepare('INSERT INTO client_native VALUES(?)').run(id);
        if(local){
          db.prepare('INSERT INTO app_local_registrations VALUES(?)').run(id);
          db.prepare('INSERT INTO app_access_policy VALUES(?,1,0)').run(id);
        }
        db.exec('COMMIT');
        return {id,name,callback,status:'pending',...brand,...profile,local,...(native?{native:true}:{})};
      } catch(error){db.exec('ROLLBACK');throw error;}
    },
    moderate(owner,id,action){
      const app=lookup.get(id,owner);
      if(!app)return false;
      if(action==='delete')return revoke.run(id).changes===1;
      if(app.status!=='active')return false;
      db.prepare('INSERT INTO app_restrictions VALUES(?,?) ON CONFLICT(id) DO UPDATE SET restricted=excluded.restricted')
        .run(id,Number(action==='restrict'));
      return true;
    },
    managed: owner=>list.all(owner).map(row=>({...appView(row),administration:!!trustedApp.get(row.id),restricted:
      db.prepare('SELECT restricted FROM app_restrictions WHERE id=?').get(row.id)?.restricted===1})),
    lookup: (owner,id) => appView(lookup.get(id,owner)),
    lookupWithBrand(owner,id){
      const app=lookup.get(id,owner);
      return appView(app&&{...app,icon:storedIcon.get(id)?.icon??null});
    },
    list: (developer) => list.all(developer).map(appView),
    published: () => db.prepare("SELECT client,name,coalesce(p.verified,0) AS verified FROM clients LEFT JOIN app_profiles p USING(id) WHERE status='active' AND id NOT IN (SELECT id FROM app_restrictions WHERE restricted=1) ORDER BY name,client LIMIT 200").all().map(app=>({...app,verified:!!app.verified})),
    revokeOwned: (owner,id) => db.prepare("UPDATE clients SET status='revoked' WHERE developer=? AND id=? AND status IN ('pending','active')").run(owner,id).changes === 1,
    has: (client) => Boolean(active.get(client)),
    approve: (id, client) => approve.run(client, id).changes === 1,
    revoke: (id) => revoke.run(id).changes === 1,
    close: () => db.close(),
  };
}
