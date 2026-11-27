import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash,generateKeyPairSync, randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { decodeJwt } from 'jose';
import { createIdentityProvider } from './oidc.mjs';
import { createAppApprovals } from './app-approval.mjs';
import { createNativeApproval } from './native-approval.mjs';
import { createAccountApprovalRoute } from './account-approval.mjs';
import { openRegistry } from './registry.mjs';
import { openApplicationData } from './application-data.mjs';

for(const environment of ['production','sandbox'])test(environment+' issuer verifies registered device and browser flows', async () => {
  const issuer='https://id.example.test';
  const registry=openRegistry(':memory:');
  const links=new Map();
  const approvals=createAppApprovals();
  const current={owner:'example-account',created:Date.now(),hash:'current-session'};
  const identity={username:'example',givenName:'Test',surname:'Person',ageRange:'adult',emails:[]};
  const second={owner:'alternate-account',created:Date.now(),hash:'second-session'};
  const alternative={...identity,username:'alternate',givenName:'Second'};
  let selected=current;
  const accounts={
    current:()=>selected,
    nativeCurrent:req=>req.headers['x-authnjs-native']==='account-manager'&&!req.headers.origin&&!req.headers.cookie?
      req.headers.authorization==='Bearer native-one'?current:req.headers.authorization==='Bearer native-two'?second:null:null,
    limitDeviceCodeLookup:()=>{},
    finishApprovedSignIn(_req,res,session){
      assert.deepEqual(session,{owner:current.owner,source:current.hash});
      res.setHeader('set-cookie','dashboard-account=saved; Path=/; Secure; HttpOnly');
      return true;
    }, identity:owner=>owner===current.owner?identity:owner===second.owner?alternative:undefined,
    browserAccountOptions:()=>({canAdd:true,accounts:[identity,alternative].map((person,slot)=>({...person,slot,current:slot===Number(selected===second)}))}),
    activateBrowserAccount:(req,_res,slot)=>{
      if(req.headers.origin!==issuer||!([0,1].includes(slot)))return false;
      selected=slot===0?current:second;return true;
    },
    grantAllowed:(owner,client,id)=>links.get(owner+':'+client)===id,
    linkedGrant:(owner,client)=>links.get(owner+':'+client),
    linkGrants:owner=>[...links].filter(([name])=>name.startsWith(owner+':')).map(([name,id])=>({client:name.slice(owner.length+1),id})),
    replaceLinkGrants:(owner,expected,replacements)=>{
      for(const {client} of expected)links.delete(owner+':'+client);
      for(const {client,id} of replacements)links.set(owner+':'+client,id);
      return true;
    },
    available:()=>true, allowsMutation:req=>req.headers.origin===issuer, recentlyConfirmed:()=>true,adminStatus:()=>403,
    rememberApp:(owner,client,_label,id)=>links.set(owner+':'+client,id), premiumEligible:()=>false,
  };
  const jwk=generateKeyPairSync('rsa',{modulusLength:2048}).privateKey.export({format:'jwk'});
  const applicationData=openApplicationData({path:':memory:',key:Buffer.alloc(32,7),registry,accounts,authenticate:()=>null});
  const provider=createIdentityProvider({issuer,database:':memory:',registry,accounts,applicationData,approvals,configuration:{
    environment,
    storageKey:'71'.repeat(32),subjectKey:'83'.repeat(32),cookieKeys:['e2'.repeat(32)],
    clients:[],jwks:{keys:[{...jwk,kid:'device-fixture',alg:'RS256',use:'sig'}]},
  }});
  async function register(name,native=false,local=false){
    const registration=registry.submit(name.startsWith('Velunivo')?current.owner:'developer',name,local?'http://127.0.0.1:8400/callback':'https://tv.example.test/callback',undefined,native,undefined,local);
    const credentials=await provider.provision(registration);
    assert.match(credentials.clientId,environment==='sandbox'?/^xid-test-/:/^xid-[0-9a-f]/);
    registry.approve(registration.id,credentials.clientId);
    return credentials;
  }
  const client=await register('Example TV');
  const other=await register('Different TV');
  const publicClient=await register('Native public',true);
  const local=await register('Local backend',false,true);
  const velunivo=await register('Velunivo fixture');
  const readingApp=await register('Velunivo Consent Test fixture');
  const [sourceRegistration,destinationRegistration]=[velunivo,readingApp].map(({clientId})=>registry.managed(current.owner).find(app=>app.client===clientId));
  registry.verifyApp(sourceRegistration.id,true);
  registry.verifyApp(destinationRegistration.id,true);
  const accountApproval=createAccountApprovalRoute({origin:issuer,accounts,approvals});
  const nativeApproval=createNativeApproval({accounts,provider,approvals,accountApproval});
  const server=createServer((req,res)=>{
    const url=new URL(req.url,issuer);
    if(url.pathname==='/account/device/review')return void nativeApproval(req,res).catch(error=>{
      if(!res.headersSent)res.writeHead(500);
      res.end(error.message);
    });
    if(url.pathname.startsWith('/account/app-storage/'))return void applicationData.handle(req,res,url);
    if(url.pathname.startsWith('/interaction/')||url.pathname.startsWith('/app-approval/')){
      void provider.interaction(req,res,url.pathname).catch(error=>{
        if(!res.headersSent)res.writeHead(500);
        res.end(error.message);
      });
    } else {
      if(url.pathname==='/device'&&url.searchParams.has('code'))req.url='/device?user_code='+url.searchParams.get('code');
      void provider.oidc(req,res);
    }
  }).listen(0,'127.0.0.1');
  await once(server,'listening');
  const cookies=new Map();
  const nonce=randomBytes(32).toString('base64url');
  async function http(path,{form,credentials,browser=false,scan=false}={}){
    const target=new URL(path,issuer);
    const headers={'x-forwarded-host':'id.example.test','x-forwarded-proto':'https',...(browser?{
      cookie:[...cookies].map(([name,value])=>name+'='+value).join('; '),origin:issuer,
    }:{}),...(credentials?.clientSecret?{
      authorization:'Basic '+Buffer.from(credentials.clientId+':'+credentials.clientSecret).toString('base64'),
    }:{}),...(scan?{origin:issuer}:{})};
    const response=await fetch('http://127.0.0.1:'+server.address().port+target.pathname+target.search,{
      method:form?'POST':'GET',headers,body:form?new URLSearchParams(form):undefined,redirect:'manual',
    });
    if(browser){
      for(const line of response.headers.getSetCookie()){
        const [name,value]=line.split(';',1)[0].split('=');
        if(value)cookies.set(name,value);
        else cookies.delete(name);
      }
    }
    return response;
  }
  const begin=(credentials,scope='openid friends')=>http('/device/auth',{credentials,form:{client_id:credentials.clientId,nonce,scope}});
  try {
    async function nativeReview(data,token='native-one'){
      return fetch('http://127.0.0.1:'+server.address().port+'/account/device/review',{
        method:'POST',headers:{'Content-Type':'application/json','X-AuthNJS-Native':'account-manager',
          ...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(data),
      });
    }
    {
      const deviceClient=await register('Native Review TV');
      const ticket=await (await begin(deviceClient,'openid friends')).json();
      assert.equal((await nativeReview({code:ticket.user_code},null)).status,401);
      const read=await nativeReview({code:ticket.user_code});
      assert.equal(read.status,200,await read.clone().text());
      const model=await read.json();
      assert.equal(model.name,'Native Review TV');
      assert.equal(model.kind,'device');
      assert.ok(model.permissions.some(permission=>permission.key==='friends'&&!permission.enabled));
      assert.equal((await nativeReview({review:model.review,action:'approve'},'native-two')).status,409);
      const grantForm={grant_type:'urn:ietf:params:oauth:grant-type:device_code',device_code:ticket.device_code};
      const pending=await http('/token',{credentials:deviceClient,form:grantForm});
      assert.equal((await pending.json()).error,'authorization_pending');
      const approve=await nativeReview({review:model.review,action:'approve',permission:['friends']});
      assert.equal(approve.status,200,await approve.clone().text());
      assert.deepEqual(await approve.json(),{approved:true});
      assert.equal((await nativeReview({review:model.review,action:'approve'})).status,409);
      const issued=await http('/token',{credentials:deviceClient,form:grantForm});
      assert.equal(issued.status,200,await issued.clone().text());
      const tokens=await issued.json();
      assert.match(tokens.scope,/friends/);
      assert.equal(decodeJwt(tokens.id_token).nonce,nonce);
      const declineTicket=await (await begin(deviceClient,'openid')).json();
      const decline=await (await nativeReview({code:declineTicket.user_code})).json();
      assert.deepEqual(await (await nativeReview({review:decline.review,action:'deny'})).json(),{approved:false});
      const denied=await http('/token',{credentials:deviceClient,form:{...grantForm,device_code:declineTicket.device_code}});
      assert.equal((await denied.json()).error,'access_denied');

      const entry=approvals.start({uid:'first-party-fixture',exp:Date.now()/1000+45});
      entry.account=true;
      const nativeAccount=await (await nativeReview({code:entry.code})).json();
      assert.equal(nativeAccount.kind,'account');
      assert.equal(entry.result,null);
      assert.deepEqual(await (await nativeReview({review:nativeAccount.review,action:'approve'})).json(),{approved:true});
      assert.deepEqual(entry.result,{owner:current.owner,source:current.hash});
    }
    async function storageSettings(id,data){
      return fetch('http://127.0.0.1:'+server.address().port+'/account/app-storage/'+id,{
        method:'POST',headers:{origin:issuer,'Content-Type':'application/json'},body:JSON.stringify({action:'sharing',...data}),
      });
    }
    const collections=['recent-neighborhoods','ride-insights'];
    const labels=['Recent neighborhoods','Ride insights'];
    assert.equal((await storageSettings(sourceRegistration.id,{shared:collections})).status,200);
    assert.equal((await storageSettings(destinationRegistration.id,{shared:[],requests:collections.map((collection,i)=>({
      source:velunivo.clientId,collection,label:labels[i],
    }))})).status,200);
    async function authorizeDevice(credentials,scope){
      const result=await begin(credentials,scope);
      assert.equal(result.status,200);
      const device=await result.json();
      const entry=await (await http(device.verification_uri_complete,{browser:true})).text();
      const code=await (await http('/device',{browser:true,form:{xsrf:entry.match(/name="xsrf" value="([^"]+)"/)?.[1],user_code:device.user_code}})).text();
      let stage=await http('/device',{browser:true,form:{xsrf:code.match(/name="xsrf" value="([^"]+)"/)?.[1],user_code:device.user_code,confirm:'yes'}});
      for(let step=0;step<5&&stage.status===303;step++)stage=await http(stage.headers.get('location'),{browser:true});
      assert.equal(stage.status,200);
      return {stage,device};
    }
    assert.ok(registry.setAdministrationTrust(destinationRegistration.id,true));
    const requestedScopes='openid app_data files_read files_write shared_files_read account_overview account_manage';
    assert.equal((await begin(other,'openid account_manage')).status,400);
    const unlinked=await authorizeDevice(readingApp,requestedScopes);
    assert.match(await unlinked.stage.text(),/Velunivo fixture<\/h2><p>Access declined/);
    await http(unlinked.stage.url,{browser:true,form:{action:'deny'}});
    const sourceConsent=await authorizeDevice(velunivo,'openid app_data');
    const sourceDone=await http(sourceConsent.stage.url,{browser:true,form:{action:'approve'}});
    await http(sourceDone.headers.get('location'),{browser:true});
    assert.ok(accounts.linkedGrant(current.owner,velunivo.clientId));
    const destination=await authorizeDevice(readingApp,requestedScopes);
    const destinationHtml=await destination.stage.text();
    assert.match(destinationHtml,/<body class="consent">/);
    assert.match(destinationHtml,/position:fixed/);
    assert.match(destinationHtml,/class="source-permissions"[\s\S]*Velunivo fixture[\s\S]*Recent neighborhoods[\s\S]*Ride insights/);
    assert.match(destinationHtml,/value="files_write" aria-label="Read and write account files" data-confirm-permission>/);
    assert.match(destinationHtml,/<h2>Administrative App Permissions<\/h2>[\s\S]*value="account_manage" aria-label="Manage account settings" data-confirm-permission>/);
    assert.equal((await http(destination.stage.url,{browser:true,form:{action:'approve',permission:'account_manage'}})).status,400);
    const approvedScopes=new URLSearchParams({action:'approve'});
    approvedScopes.append('permission','account_overview');
    approvedScopes.append('permission','account_manage');
    approvedScopes.append('confirm-permission','account_manage');
    approvedScopes.append('permission','files_read');
    approvedScopes.append('permission','shared_files_read');
    approvedScopes.append('data-permission',velunivo.clientId+'/recent-neighborhoods');
    const destinationDone=await http(destination.stage.url,{browser:true,form:approvedScopes});
    await http(destinationDone.headers.get('location'),{browser:true});
    const issued=await (await http('/token',{credentials:readingApp,form:{
      grant_type:'urn:ietf:params:oauth:grant-type:device_code',device_code:destination.device.device_code,
    }})).json();
    assert.equal(await provider.overviewAccess(issued.access_token),current.owner);
    assert.equal(await provider.overviewAccess(issued.access_token,'account_manage'),current.owner);
    await provider.connectedPermissions(current.owner,readingApp.clientId,{scope:'account_manage',enabled:false});
    assert.equal(await provider.overviewAccess(issued.access_token,'account_manage'),null);
    assert.equal(await provider.connectedPermissions(current.owner,readingApp.clientId,{scope:'account_manage',enabled:true}),false);
    await provider.connectedPermissions(current.owner,readingApp.clientId,{scope:'account_manage',enabled:true,confirmed:true});
    assert.equal(await provider.overviewAccess(issued.access_token,'account_manage'),current.owner);
    assert.ok(registry.setAdministrationTrust(destinationRegistration.id,false));
    assert.equal(await provider.overviewAccess(issued.access_token),null);
    assert.equal(await provider.overviewAccess(issued.access_token,'account_manage'),null);
    assert.ok(await provider.fileAccess(issued.access_token,['files_read']));
    assert.ok(await provider.fileAccess(issued.access_token,['shared_files_read']));
    assert.equal(await provider.fileAccess(issued.access_token,['files_write']),null);
    assert.deepEqual(applicationData.permissions(current.owner).filter(permission=>permission.destination===readingApp.clientId)
      .map(({collection,enabled})=>[collection,enabled]),[['recent-neighborhoods',true],['ride-insights',false]]);
    await provider.connectedPermissions(current.owner,readingApp.clientId,{scope:'files_read',enabled:false});
    assert.equal(await provider.fileAccess(issued.access_token,['files_read']),null);
    assert.equal((await begin(publicClient)).status,400);
    assert.equal((await begin(local)).status,200);
    const source=registry.managed('developer').find(app=>app.name==='Different TV');
    assert.equal(registry.crossReadAllowed(other.clientId,local.clientId),false);
    assert.equal(registry.setReaderTrust('developer',source.id,'any'),true);
    assert.equal(registry.crossReadAllowed(other.clientId,local.clientId),true);
    assert.equal(registry.setReaderTrust('developer',source.id,'verified'),true);
    assert.equal(registry.crossReadAllowed(other.clientId,local.clientId),false);
    assert.equal(registry.crossReadAllowed(other.clientId,client.clientId),false);
    assert.notEqual((await begin({clientId:client.clientId})).status,200);
    const created=await begin(client);
    assert.equal(created.status,200,await created.clone().text());
    const device=await created.json();
    assert.match(device.user_code,/^[BCDFGHJKLMNPQRSTVWXZ]{6}$/);
    assert.equal(device.verification_uri_complete,issuer+'/device?code='+device.user_code);
    const poll=credentials=>http('/token',{credentials,form:{
      grant_type:'urn:ietf:params:oauth:grant-type:device_code',device_code:device.device_code,
    }});
    assert.equal((await (await poll(client)).json()).error,'authorization_pending');
    assert.equal((await (await poll(other)).json()).error,'invalid_grant');

    const qr=await (await http(device.verification_uri_complete,{browser:true})).text();
    const xsrf=qr.match(/name="xsrf" value="([^"]+)"/)?.[1];
    assert.ok(xsrf);
    const confirm=await (await http('/device',{browser:true,form:{xsrf,user_code:device.user_code}})).text();
    assert.match(confirm,/Confirm sign-in on this device/);
    assert.match(confirm,/Example TV/);
    assert.match(confirm,new RegExp(device.user_code));
    const confirmToken=confirm.match(/name="xsrf" value="([^"]+)"/)?.[1];
    let stage=await http('/device',{browser:true,form:{xsrf:confirmToken,user_code:device.user_code,confirm:'yes'}});
    for(let step=0;step<5&&stage.status===303;step++)stage=await http(stage.headers.get('location'),{browser:true});
    const consent=await stage.text();
    assert.match(consent,/Link Example TV to X-Center ID/);
    assert.match(consent,/aria-label="App developer"[\s\S]*?<\/section>\s*<section class="context" aria-label="Signing in as"/);
    const interaction=stage.url.split('/interaction/')[1];
    stage=await http('/interaction/'+interaction,{browser:true,form:{action:'approve',permission:'friends'}});
    assert.equal(stage.status,303,await stage.clone().text());
    const approved=await http(stage.headers.get('location'),{browser:true});
    assert.match(await approved.text(),/Device sign-in approved/);
    const response=await poll(client);
    assert.equal(response.status,200,await response.clone().text());
    assert.equal(decodeJwt((await response.json()).id_token).nonce,nonce);

    const grants=await provider.connectedPermissions(current.owner,client.clientId);
    assert.equal(grants.find(scope=>scope.scope==='friends').enabled,true);
    assert.equal(await provider.connectedPermissions('different-account',client.clientId),null);
    assert.equal(await provider.connectedPermissions(current.owner,client.clientId,{scope:'profile',enabled:false}),false);
    assert.equal((await provider.connectedPermissions(current.owner,client.clientId,{scope:'friends',enabled:false})).find(scope=>scope.scope==='friends').enabled,false);
    assert.equal((await provider.connectedPermissions(current.owner,client.clientId,{scope:'friends',enabled:true})).find(scope=>scope.scope==='friends').enabled,true);
    const again=await (await begin(client)).json();
    const manualResponse=await http('/device',{browser:true});
    const manual=await manualResponse.text();
    assert.match(manual,/Sign in on another device/);
    assert.equal((manual.match(/<input type="text" aria-label="Character [1-6] of 6"/g)??[]).length,6);
    const scriptNonce=manual.match(/<script nonce="([^"]+)"/)?.[1];
    assert.ok(scriptNonce);
    assert.ok(manualResponse.headers.get('content-security-policy').includes("script-src 'nonce-"+scriptNonce+"'"));
    assert.equal((manual.match(/<input[^>]+name="user_code"/g)??[]).length,1);
    const manualXsrf=manual.match(/name="xsrf" value="([^"]+)"/)?.[1];
    const review=await (await http('/device',{browser:true,form:{xsrf:manualXsrf,user_code:again.user_code}})).text();
    assert.match(review,/Confirm sign-in on this device/);
    const secondXsrf=review.match(/name="xsrf" value="([^"]+)"/)?.[1];
    let returning=await http('/device',{browser:true,form:{xsrf:secondXsrf,user_code:again.user_code,confirm:'yes'}});
    assert.equal(returning.status,303,await returning.clone().text());
    returning=await http(returning.headers.get('location'),{browser:true});
    const returningHtml=await returning.text();
    assert.match(returningHtml,/Authorize logging back into Example TV/);
    assert.match(returningHtml,/already linked/);
    assert.match(returningHtml,/Friends list/);
    assert.match(returningHtml,/permission-fixed/);
    const denied=await http('/interaction/'+returning.url.split('/interaction/')[1],{browser:true,form:{action:'deny'}});
    await http(denied.headers.get('location'),{browser:true});
    const pollDenied=await http('/token',{credentials:client,form:{
      grant_type:'urn:ietf:params:oauth:grant-type:device_code',device_code:again.device_code,
    }});
    assert.equal((await pollDenied.json()).error,'access_denied');
    assert.equal((await (await poll(client)).json()).error,'invalid_grant');
    const app=registry.published().find(app=>app.client===client.clientId);
    const registration=registry.managed('developer').find(app=>app.name==='Example TV');
    assert.ok(app&&registration);
    assert.equal(registry.saveAccess('unrelated',registration.id,{action:'settings',private:true,requests:true}),false);
    assert.equal(registry.saveAccess('developer',registration.id,{action:'settings',private:true,requests:true}),true);
    const constrained=await (await begin(client)).json();
    const codePage=await (await http(constrained.verification_uri_complete,{browser:true})).text();
    const codeXsrf=codePage.match(/name="xsrf" value="([^"]+)"/)?.[1];
    const codeConfirm=await (await http('/device',{browser:true,form:{xsrf:codeXsrf,user_code:constrained.user_code}})).text();
    const formXsrf=codeConfirm.match(/name="xsrf" value="([^"]+)"/)?.[1];
    let blocked=await http('/device',{browser:true,form:{xsrf:formXsrf,user_code:constrained.user_code,confirm:'yes'}});
    for(let step=0;step<5&&blocked.status===303;step++)blocked=await http(blocked.headers.get('location'),{browser:true});
    assert.equal(blocked.headers.get('referrer-policy'),'same-origin');
    const blockedHtml=await blocked.text();
    assert.match(blockedHtml,/don’t have permission/);
    assert.match(blockedHtml,/aria-label="Switch account"/);
    const requested=await http('/interaction/'+blocked.url.split('/interaction/')[1],{browser:true,form:{action:'request'}});
    assert.match(await requested.text(),/Access requested/);
    assert.equal(registry.access(current.owner,client.clientId).pending,true);
    assert.equal(registry.saveAccess('developer',registration.id,{action:'approve',account:current.owner}),true);
    assert.equal(registry.access(current.owner,client.clientId).allowed,true);
    const rotated=await provider.changeClientSecret(client.clientId,'rotate');
    assert.notEqual((await begin(client)).status,200);
    assert.equal((await begin(rotated)).status,200);
    await provider.changeClientSecret(client.clientId,'revoke');
    assert.notEqual((await begin(rotated)).status,200);

    // Start a normal browser authorization with an existing dashboard account.
    const webClient=await register('Browser switching');
    const verifier=randomBytes(32).toString('base64url');
    const state=randomBytes(32).toString('base64url');
    const callback='https://tv.example.test/callback';
    const browserParams=new URLSearchParams({
      client_id:webClient.clientId,redirect_uri:callback,response_type:'code',scope:'openid',state,nonce,
      code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256',
    });
    const deniedBrowser=await http('/auth?'+new URLSearchParams({...Object.fromEntries(browserParams),scope:'openid account_manage'}),{browser:true});
    assert.equal(new URL(deniedBrowser.headers.get('location')).searchParams.get('error'),'invalid_scope');
    let web=await http('/auth?'+browserParams,{browser:true});
    for(let step=0;step<6&&web.status===303;step++)web=await http(web.headers.get('location'),{browser:true});
    const webHtml=await web.text();
    assert.match(webHtml,/Link Browser switching to X-Center ID/);
    assert.doesNotMatch(webHtml,/<h1>Choose your account/);
    assert.match(webHtml,/@example/);
    const original=new URL(web.url).pathname;
    const choose=original+'?choose=account';
    const choices=await(await http(choose,{browser:true})).text();
    assert.match(choices,/<h1>Choose your account/);
    assert.match(choices,/value="1"[\s\S]*@alternate/);
    assert.match(choices,/Add another account/);
    assert.doesNotMatch(choices,/Sign out/);

    let switched=await http(choose,{browser:true,form:{slot:'1'}});
    assert.equal(switched.headers.get('location'),original);
    assert.equal((await http(original,{browser:true,form:{action:'approve'}})).status,409);
    for(let step=0;step<8;step++){
      if(switched.status===303){
        switched=await http(switched.headers.get('location'),{browser:true});
      }else {
        const text=await switched.clone().text();
        const action=text.match(/<form method="post" action="([^"]+session\/end\/confirm)"/)?.[1];
        if(!action)break;
        const xsrf=text.match(/name="xsrf" value="([^"]+)"/)?.[1];
        assert.ok(xsrf);
        switched=await http(action,{browser:true,form:{xsrf,logout:'yes'}});
      }
    }
    const newHtml=await switched.text();
    assert.match(newHtml,/Link Browser switching to X-Center ID/);
    assert.match(newHtml,/@alternate/);
    assert.doesNotMatch(newHtml,/@example/);
    let browserGrant=await http(new URL(switched.url).pathname,{browser:true,form:{action:'approve'}});
    for(let step=0;step<5&&browserGrant.status===303&&new URL(browserGrant.headers.get('location'),issuer).origin===issuer;step++){
      browserGrant=await http(browserGrant.headers.get('location'),{browser:true});
    }
    const redirect=new URL(browserGrant.headers.get('location'));
    assert.equal(redirect.searchParams.get('state'),state);
    const tokenResponse=await http('/token',{credentials:webClient,form:{
      grant_type:'authorization_code',code:redirect.searchParams.get('code'),redirect_uri:callback,code_verifier:verifier,
    }});
    assert.equal(tokenResponse.status,200,await tokenResponse.clone().text());
    assert.ok(accounts.linkedGrant(second.owner,webClient.clientId));
    assert.equal(accounts.linkedGrant(current.owner,webClient.clientId),undefined);
    assert.ok(accounts.linkedGrant(current.owner,readingApp.clientId));

    {
      const remoteClient=await register('Remote browser approval',true);
      const remoteState=randomBytes(32).toString('base64url');
      const remoteParams=new URLSearchParams({...Object.fromEntries(browserParams),client_id:remoteClient.clientId,state:remoteState,scope:'openid offline_access',prompt:'consent'});
      cookies.clear();
      selected=null;
      const start=await http('/auth?'+remoteParams,{browser:true});
      const originalPath=new URL(start.headers.get('location'),issuer).pathname;
      const signIn=await http(originalPath,{browser:true});
      assert.equal(signIn.headers.get('location'),'/signin?continue='+encodeURIComponent(originalPath));
      assert.deepEqual(await (await http(originalPath+'?qr=info',{browser:true})).json(),{
        name:'Remote browser approval',icon:null,canApproveRemotely:true,
      });
      assert.equal((await http(originalPath+'?qr=info')).status,400);
      assert.deepEqual(await (await http(originalPath+'?qr=status',{browser:true})).json(),{state:'expired'});
      const wait=await http(originalPath+'?qr=start',{browser:true,form:{}});
      const {code,image}=await wait.json();
      assert.equal(wait.status,200);
      assert.match(image,/^data:image\/svg\+xml;base64,/);
      const scanned='/app-approval/'+approvals.forCode(code).key;
      assert.equal((await http(originalPath+'?qr=status',{scan:true})).status,400);
      assert.equal((await http(scanned,{scan:true})).status,303);
      selected=current;
      const remoteReview=await (await http(scanned,{scan:true})).text();
      assert.match(remoteReview,/Link Remote browser approval to X-Center ID/);
      assert.match(remoteReview,/@example/);
      const proof=remoteReview.match(/name="review_proof" value="([^"]+)"/)?.[1];
      assert.ok(proof);
      assert.doesNotMatch(remoteReview,/name="qr_code"/);
      assert.match(remoteReview,/role="switch" name="save_account" value="yes">/);
      const confirm={action:'approve',review_proof:proof,permission:'offline_access'};
      assert.equal((await http(scanned,{form:confirm})).status,403);
      assert.equal((await http(scanned,{scan:true,form:{...confirm,review_proof:'invalid'}})).status,409);
      selected=second;
      assert.equal((await http(scanned,{scan:true,form:confirm})).status,409);
      selected=current;
      const approval=await http(scanned,{scan:true,form:confirm});
      assert.equal(approval.status,200,await approval.clone().text());
      assert.equal(approval.headers.get('location'),null);
      assert.match(await approval.text(),/App sign-in approved/);
      assert.equal((await http(scanned,{scan:true,form:confirm})).status,400);
      selected=null;
      assert.deepEqual(await (await http(originalPath+'?qr=status',{browser:true})).json(),{state:'ready'});
      let pickup=await http(originalPath+'?qr=finish',{browser:true,form:{}});
      for(let step=0;step<5&&pickup.status===303&&new URL(pickup.headers.get('location'),issuer).origin===issuer;step++){
        pickup=await http(pickup.headers.get('location'),{browser:true});
      }
      const remoteRedirect=new URL(pickup.headers.get('location'));
      assert.equal(cookies.has('dashboard-account'),false);
      assert.equal(remoteRedirect.searchParams.get('state'),remoteState);
      assert.ok(remoteRedirect.searchParams.get('code'),remoteRedirect.href);
      assert.equal((await http(originalPath+'?qr=finish',{browser:true,form:{}})).status,400);
      const redemption=await http('/token',{form:{client_id:remoteClient.clientId,
        grant_type:'authorization_code',code:remoteRedirect.searchParams.get('code'),redirect_uri:callback,code_verifier:verifier,
      }});
      assert.equal(redemption.status,200,await redemption.clone().text());
      assert.ok(accounts.linkedGrant(current.owner,remoteClient.clientId));
      const approved=await redemption.json();
      assert.ok(approved.refresh_token);
      cookies.clear();
      const secondStart=await http('/auth?'+remoteParams,{browser:true});
      const secondPath=new URL(secondStart.headers.get('location'),issuer).pathname;
      const nextQr=await (await http(secondPath+'?qr=start',{browser:true,form:{}})).json();
      const nextReview='/app-approval/'+approvals.forCode(nextQr.code).key;
      const nativeApp=await (await nativeReview({target:nextReview})).json();
      assert.equal(nativeApp.kind,'app');
      assert.equal(nativeApp.name,'Remote browser approval');
      assert.equal(nativeApp.saveAccount,true);
      const kept=await nativeReview({review:nativeApp.review,action:'approve',permission:['offline_access'],save_account:'yes'});
      assert.equal(kept.status,200,await kept.clone().text());
      assert.equal(kept.headers.get('set-cookie'),null);
      selected=null;
      const keepPickup=await http(secondPath+'?qr=finish',{browser:true,form:{}});
      assert.equal(keepPickup.status,303,await keepPickup.clone().text());
      assert.equal(cookies.get('dashboard-account'),'saved');
      assert.equal((await http(secondPath+'?qr=finish',{browser:true,form:{}})).status,400);

      const oldGrant=accounts.linkedGrant(current.owner,remoteClient.clientId);
      const otherGrant=accounts.linkedGrant(second.owner,webClient.clientId);
      assert.equal(await provider.endAppSessions(current.owner,()=>false),false);
      assert.equal(accounts.linkedGrant(current.owner,remoteClient.clientId),oldGrant);
      assert.equal(await provider.endAppSessions(current.owner,()=>true),true);
      assert.notEqual(accounts.linkedGrant(current.owner,remoteClient.clientId),oldGrant);
      assert.equal(accounts.linkedGrant(second.owner,webClient.clientId),otherGrant);
      assert.ok((await provider.connectedPermissions(current.owner,remoteClient.clientId)).some(item=>item.scope==='profile'&&item.enabled));
      const rejected=await fetch('http://127.0.0.1:'+server.address().port+'/me',{
        headers:{'x-forwarded-host':'id.example.test','x-forwarded-proto':'https',authorization:'Bearer '+approved.access_token},
      });
      assert.equal(rejected.status,401);
      const refresh=await http('/token',{form:{client_id:remoteClient.clientId,grant_type:'refresh_token',refresh_token:approved.refresh_token}});
      assert.equal(refresh.status,400);
      assert.equal((await refresh.json()).error,'invalid_grant');

    }

  } finally {
    await new Promise(resolve=>server.close(resolve));
    applicationData.close();registry.close();
  }
});
