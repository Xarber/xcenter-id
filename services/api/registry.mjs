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
    CREATE TABLE IF NOT EXISTS app_restrictions(id TEXT PRIMARY KEY, restricted INTEGER NOT NULL) STRICT;
    CREATE TABLE IF NOT EXISTS client_native(id TEXT PRIMARY KEY) STRICT;
    CREATE TABLE IF NOT EXISTS app_profiles(id TEXT PRIMARY KEY, description TEXT NOT NULL, repository TEXT NOT NULL, callbacks TEXT NOT NULL, verified INTEGER NOT NULL DEFAULT 0) STRICT;
    CREATE TABLE IF NOT EXISTS app_requirements(id TEXT PRIMARY KEY, email INTEGER NOT NULL, age_range INTEGER NOT NULL) STRICT;
    CREATE TABLE IF NOT EXISTS developer_github_profiles(owner TEXT PRIMARY KEY, url TEXT NOT NULL) STRICT;
    CREATE TABLE IF NOT EXISTS developer_profiles(owner TEXT PRIMARY KEY,name TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'unverified') STRICT;
  `);
  const add = db.prepare("INSERT INTO clients (id, developer, name, callback) SELECT ?, ?, ?, ? WHERE (SELECT count(*) FROM clients WHERE developer = ? AND status <> 'revoked') < 30");
  const list = db.prepare(`SELECT c.id,c.name,c.callback,c.client,c.status,b.developer_name AS developerName,b.icon,p.description,p.repository,p.callbacks,p.verified,EXISTS(SELECT 1 FROM client_native n WHERE n.id=c.id) AS native FROM clients c
    LEFT JOIN client_brand b ON b.id=c.id LEFT JOIN app_profiles p ON p.id=c.id WHERE c.developer=? ORDER BY c.name,c.id`);
  const lookup = db.prepare('SELECT c.*,p.description,p.repository,p.callbacks,p.verified,EXISTS(SELECT 1 FROM client_native n WHERE n.id=c.id) AS native FROM clients c LEFT JOIN app_profiles p ON p.id=c.id WHERE c.id=? AND c.developer=?');
  const active = db.prepare("SELECT 1 FROM clients WHERE client = ? AND status = 'active' AND id NOT IN (SELECT id FROM app_restrictions WHERE restricted=1)");
  const approve = db.prepare("UPDATE clients SET client = ?, status = 'active' WHERE id = ? AND status = 'pending'");
  const revoke = db.prepare("UPDATE clients SET status = 'revoked' WHERE id = ? AND status IN ('pending','active')");

  const setBrand=db.prepare(`INSERT INTO client_brand VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET
    developer_name=excluded.developer_name,icon=excluded.icon`);
  const readRequirements=db.prepare("SELECT email,age_range FROM app_requirements WHERE id=?");
  const appView=row=>row?{...row,description:row.description??'',repository:row.repository??'',
    callbacks:row.callbacks?JSON.parse(row.callbacks):[row.callback],verified:!!row.verified,...(row.id?{requirements:requirements(row.id)}:{})}:undefined;
  const requirements=id=>{const row=readRequirements.get(id);return {email:!!row?.email,age_range:!!row?.age_range};};
  const detailByClient=db.prepare(`SELECT c.name,c.callback,p.callbacks FROM clients c LEFT JOIN app_profiles p ON p.id=c.id
    WHERE c.client=? AND c.status='active' AND c.id NOT IN (SELECT id FROM app_restrictions WHERE restricted=1)`);
  const writeAppProfile=db.prepare(`INSERT INTO app_profiles(id,description,repository,callbacks) VALUES(?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET description=excluded.description,repository=excluded.repository,callbacks=excluded.callbacks,verified=0`);
  const readDeveloper=db.prepare('SELECT name,status FROM developer_profiles WHERE owner=?');
  const readOpenSource=db.prepare(`SELECT p.repository FROM app_profiles p JOIN clients c ON c.id=p.id
    WHERE c.developer=? AND c.status='active' AND p.repository<>'' LIMIT 1`);
  const githubProfile=db.prepare('SELECT url FROM developer_github_profiles WHERE owner=?');
  const developerView=owner=>({...readDeveloper.get(owner)??{name:'',status:'unverified'},githubProfile:githubProfile.get(owner)?.url??''});
  const setAppName=db.prepare('UPDATE clients SET name=?,callback=? WHERE id=? AND developer=?');
  return {
    registration:id=>db.prepare('SELECT c.id,c.client,c.developer,c.status,p.verified FROM clients c LEFT JOIN app_profiles p ON p.id=c.id WHERE c.id=?').get(id),
    clientForId:id=>db.prepare('SELECT client FROM clients WHERE id=?').get(id)?.client,
    brand: (client) => db.prepare(`SELECT c.developer AS owner,c.name,coalesce(nullif(d.name,''),b.developer_name) AS developerName,
      b.icon,p.description,p.repository,p.verified,d.status AS developerStatus,r.email AS requiresEmail,r.age_range AS requiresAgeRange
      FROM clients c LEFT JOIN client_brand b ON b.id=c.id LEFT JOIN app_profiles p ON p.id=c.id
      LEFT JOIN developer_profiles d ON d.owner=c.developer LEFT JOIN app_requirements r ON r.id=c.id WHERE c.client=? AND c.status='active' AND c.id NOT IN (SELECT id FROM app_restrictions WHERE restricted=1)`).get(client),
    publicDetails: client=>appView(detailByClient.get(client)),
    developer: developerView,
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
    saveApp(owner,id,profile){
      const previous=appView(lookup.get(id,owner));
      if(!previous||previous.status==='revoked')return null;
      if(previous.status!=='pending'&&new URL(previous.callback).origin!==new URL(profile.callbacks[0]).origin)return null;
      db.exec('BEGIN IMMEDIATE');
      try{
        setAppName.run(profile.name,profile.callbacks[0],id,owner);
        const oldBrand=db.prepare('SELECT developer_name FROM client_brand WHERE id=?').get(id);
        setBrand.run(id,oldBrand?.developer_name??'',profile.icon);
        writeAppProfile.run(id,profile.description,profile.repository,JSON.stringify(profile.callbacks));
        db.exec('COMMIT');
        return {...appView(lookup.get(id,owner)),icon:profile.icon};
      }catch(error){db.exec('ROLLBACK');throw error;}
    },
    administration:()=>({
      apps:db.prepare(`SELECT c.id,c.name,c.callback,c.status,p.description,p.repository,p.verified,d.name AS developerName
        FROM clients c LEFT JOIN app_profiles p ON p.id=c.id LEFT JOIN developer_profiles d ON d.owner=c.developer
        ORDER BY c.status,c.name LIMIT 300`).all().map(app=>({...app,verified:!!app.verified})),
      developers:db.prepare("SELECT owner,name,status FROM developer_profiles WHERE status IN ('requested','verified') ORDER BY name LIMIT 300").all()
        .map(developer=>({...developer,repository:readOpenSource.get(developer.owner)?.repository??null,githubProfile:githubProfile.get(developer.owner)?.url??null})),
    }),
    verifyApp(id,verified){
      const item=db.prepare("SELECT callback FROM clients WHERE id=? AND status IN ('pending','active')").get(id);
      if(!item)return false;
      db.prepare(`INSERT INTO app_profiles VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET verified=excluded.verified`)
        .run(id,'','',JSON.stringify([item.callback]),Number(verified));
      return true;
    },
    verifyDeveloper(owner,verified){
      if(verified&&!readOpenSource.get(owner))return false;
      return db.prepare("UPDATE developer_profiles SET status=? WHERE owner=? AND status IN ('requested','verified')")
        .run(verified?'verified':'unverified',owner).changes===1;
    },
    updateBrand(owner,id,brand) {
      const item=lookup.get(id,owner);
      if(!item||item.status==='revoked')return false;
      setBrand.run(id,brand.developerName,brand.icon);
      db.prepare('UPDATE app_profiles SET verified=0 WHERE id=?').run(id);
      return true;
    },
    submit(developer, name, callback, brand, native = false, profile) {
      const id = randomUUID();
      db.exec('BEGIN IMMEDIATE');
      try {
        if(!add.run(id,developer,name,callback,developer).changes){db.exec('COMMIT');return null;}
        if(brand)setBrand.run(id,brand.developerName,brand.icon);
        if(profile)writeAppProfile.run(id,profile.description,profile.repository,JSON.stringify(profile.callbacks));
        if(native)db.prepare('INSERT INTO client_native VALUES(?)').run(id);
        db.exec('COMMIT');
        return {id,name,callback,status:'pending',...brand,...profile,...(native?{native:true}:{})};
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
    managed: owner=>list.all(owner).map(row=>({...appView(row),restricted:
      db.prepare('SELECT restricted FROM app_restrictions WHERE id=?').get(row.id)?.restricted===1})),
    lookup: (owner,id) => appView(lookup.get(id,owner)),
    list: (developer) => list.all(developer).map(appView),
    published: () => db.prepare("SELECT client,name,coalesce(p.verified,0) AS verified FROM clients LEFT JOIN app_profiles p USING(id) WHERE status='active' AND id NOT IN (SELECT id FROM app_restrictions WHERE restricted=1) ORDER BY name,client LIMIT 200").all().map(app=>({...app,verified:!!app.verified})),
    revokeOwned: (owner,id) => db.prepare("UPDATE clients SET status='revoked' WHERE developer=? AND id=? AND status IN ('pending','active')").run(owner,id).changes === 1,
    has: (client) => Boolean(active.get(client)),
    approve: (id, client) => approve.run(client, id).changes === 1,
    revoke: (id) => revoke.run(id).changes === 1,
    close: () => db.close(),
  };
}
