import {createHash} from 'node:crypto';
import {validateApplicationProfile} from './application-profile.mjs';
import {writeSharing} from './application-sharing.mjs';
import {readJson} from './server.mjs';

const objectKeys = (value,fields) => value && typeof value==='object' && !Array.isArray(value) &&
  Object.keys(value).length===fields.length && fields.every(field=>Object.hasOwn(value,field));
const fingerprint = config => createHash('sha256').update(JSON.stringify(config)).digest('base64url');
const same = (left,right) => JSON.stringify(left)===JSON.stringify(right);
const strings = (value,max) => typeof value==='string'&&value.length<=max;

export function appConfiguration({accounts,registry,applicationData}){
  return async (req,res,id) => {
    const answer=(status,body)=>res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'}).end(JSON.stringify(body));
    const owner=accounts.current(req)?.owner;
    const lookup=()=>{
      if(!owner||accounts.current(req)?.owner!==owner||!accounts.available(owner))return null;
      const app=registry.lookupWithBrand(owner,id);
      return app?.status!=='revoked'?app:null;
    };
    const view=app=>{
      const access=registry.accessSettings(owner,id);
      return {version:1, profile:{name:app.name,description:app.description,repository:app.repository,callbacks:app.callbacks,icon:app.icon??null},
        requirements:app.requirements,
        access:{private:access.private,allowRequests:access.requests,readerTrust:registry.readerTrust(id)},
        storage:app.client&&applicationData?{...applicationData.sharing(app.client),showInFiles:applicationData.fileVisibility(app.client)}:null};
    };
    const initial=lookup();
    if(!initial)return answer(404,{error:'Registration unavailable.'});
    const before=view(initial);
    if(req.method==='GET')return answer(200,{configuration:before,revision:fingerprint(before)});
    if(req.method!=='PUT')return answer(405,{error:'Method unavailable.'});
    const allowed=()=>accounts.allowsMutation(req)&&accounts.recentlyConfirmed(req)&&req.headers['x-authnjs-request']==='developer-portal';
    if(!allowed())return answer(403,{error:'Confirm your identity in Developer Apps first.'});
    try{
      const input=await readJson(req,160_000);
      const {configuration, revision, confirmUnsecure}=input??{};
      if(revision!==fingerprint(before))return answer(409,{error:'Configuration changed. Reopen the code screen and apply your edits to the latest copy.'});
      if(!objectKeys(configuration,['version','profile','requirements','access','storage'])||configuration.version!==1)return answer(422,{error:'Use the version 1 configuration shape.'});
      const {profile,requirements,access,storage}=configuration;
      if(!objectKeys(profile,['name','description','repository','callbacks','icon'])||!strings(profile.name,80)||!strings(profile.description,500)||
         !strings(profile.repository,200)||!Array.isArray(profile.callbacks)||profile.icon!==null&&!strings(profile.icon,46_000)){
        return answer(422,{error:'Check the profile name, icon, description, repository and callbacks.'});
      }
      if(!objectKeys(requirements,['email','age_range'])||typeof requirements.email!=='boolean'||typeof requirements.age_range!=='boolean'){
        return answer(422,{error:'Set email and age range requirements to true or false.'});
      }
      if(!objectKeys(access,['private','allowRequests','readerTrust'])||typeof access.private!=='boolean'||typeof access.allowRequests!=='boolean'||
         access.allowRequests&&!access.private||!['secure','verified','any'].includes(access.readerTrust)){
        return answer(422,{error:'Check the private app and reader trust settings.'});
      }
      if((access.readerTrust==='any'&&before.access.readerTrust!=='any'||initial.local&&!same(storage,before.storage))&&confirmUnsecure!==true){
        return answer(422,{error:'Confirm how this change affects unsecure app access.'});
      }
      // Preserve a byte-identical stored icon on round trip, while validating any replacement.
      const nextProfile=await validateApplicationProfile({...profile,icon:profile.icon===before.profile.icon?null:profile.icon},{local:initial.local});
      if(profile.icon===before.profile.icon)nextProfile.icon=profile.icon;
      const current=lookup();
      if(!current||!allowed())return answer(403,{error:'Confirm your identity in Developer Apps first.'});
      if(fingerprint(view(current))!==revision)return answer(409,{error:'Configuration changed. Reopen the code screen and try again.'});
      let applyStorage;
      if(!same(storage,before.storage)){
        if(!current.client||!registry.has(current.client)||!applicationData)return answer(422,{error:'Activate the registration before editing storage.'});
        if(!objectKeys(storage,['shared','requests','showInFiles'])||typeof storage.showInFiles!=='boolean')return answer(422,{error:'Check the storage settings.'});
        if(storage.showInFiles!==before.storage.showInFiles&&!current.verified)return answer(403,{error:'Showing data in Files requires a verified app.'});
        const sharingChanged=!same([storage.shared,storage.requests],[before.storage.shared,before.storage.requests]);
        const plan=sharingChanged?applicationData.prepareSharing(current.client,storage):null;
        applyStorage=(db,schema)=>{
          if(plan)writeSharing(db,schema,current.client,plan);
          if(storage.showInFiles===before.storage.showInFiles)return;
          if(storage.showInFiles)db.prepare('INSERT OR IGNORE INTO hosted_config.app_file_visibility VALUES(?)').run(current.client);
          else db.prepare('DELETE FROM hosted_config.app_file_visibility WHERE client=?').run(current.client);
        };
      }
      if(!registry.saveConfiguration(owner,id,{profile:nextProfile,requirements,access},applyStorage)){
        return answer(422,{error:'An active registration’s verified callback origin cannot change.'});
      }
      const updated=view(lookup());
      return answer(200,{configuration:updated,revision:fingerprint(updated)});
    }catch(error){
      if(error.status>=500||error.code?.startsWith('ERR_SQLITE'))return answer(503,{error:'Configuration could not be saved. Try again.'});
      return answer(error.status??422,{error:error.message});
    }
  };
}
