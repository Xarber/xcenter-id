import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { decodeJwt } from 'jose';
import { createIdentityProvider } from './oidc.mjs';
import { openRegistry } from './registry.mjs';

test('registered device flow confirms linking and issues a single nonce-bound token response', async () => {
  const issuer='https://id.example.test';
  const registry=openRegistry(':memory:');
  const links=new Map();
  const current={owner:'example-account',created:Date.now()};
  const identity={username:'example',givenName:'Test',surname:'Person',ageRange:'adult',emails:[]};
  const accounts={
    current:()=>current, identity:owner=>owner===current.owner?identity:undefined,
    grantAllowed:(owner,client,id)=>owner===current.owner&&links.get(client)===id,
    linkedGrant:(owner,client)=>owner===current.owner?links.get(client):undefined,
    rememberApp:(_owner,client,_label,id)=>links.set(client,id), premiumEligible:()=>false,
  };
  const jwk=generateKeyPairSync('rsa',{modulusLength:2048}).privateKey.export({format:'jwk'});
  const provider=createIdentityProvider({issuer,database:':memory:',registry,accounts,configuration:{
    storageKey:'71'.repeat(32),subjectKey:'83'.repeat(32),cookieKeys:['e2'.repeat(32)],
    clients:[],jwks:{keys:[{...jwk,kid:'device-fixture',alg:'RS256',use:'sig'}]},
  }});
  async function register(name,native=false,local=false){
    const registration=registry.submit('developer',name,local?'http://127.0.0.1:8400/callback':'https://tv.example.test/callback',undefined,native,undefined,local);
    const credentials=await provider.provision(registration);
    registry.approve(registration.id,credentials.clientId);
    return credentials;
  }
  const client=await register('Example TV');
  const other=await register('Different TV');
  const publicClient=await register('Native public',true);
  const local=await register('Local backend',false,true);
  const server=createServer((req,res)=>{
    const url=new URL(req.url,issuer);
    if(url.pathname.startsWith('/interaction/')){
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
  async function http(path,{form,credentials,browser=false}={}){
    const target=new URL(path,issuer);
    const headers={'x-forwarded-host':'id.example.test','x-forwarded-proto':'https',...(browser?{
      cookie:[...cookies].map(([name,value])=>name+'='+value).join('; '),origin:issuer,
    }:{}),...(credentials?.clientSecret?{
      authorization:'Basic '+Buffer.from(credentials.clientId+':'+credentials.clientSecret).toString('base64'),
    }:{})};
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
    const manual=await (await http('/device',{browser:true})).text();
    assert.match(manual,/Sign in on another device/);
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
    assert.match(await blocked.text(),/don’t have permission/);
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

  } finally {
    await new Promise(resolve=>server.close(resolve));
    registry.close();
  }
});
