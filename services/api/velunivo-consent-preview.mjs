import * as oidc from 'openid-client';

const host='https://consent-test.xcenter.it';
const callback=host+'/callback';
const lifetime=5*60*1000;
const cookieName='__Host-xcenter-consent-flow';
const headers={
  'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'no-referrer',
  'X-Robots-Tag':'noindex, nofollow',
  'Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'",
};

function page(res,status,title,body){
  res.writeHead(status,headers).end(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${title}</title>
    <style>body{color-scheme:light dark;background:Canvas;color:CanvasText;font:1rem/1.55 system-ui;margin:0}main{max-width:36rem;margin:auto;padding:4rem 1.5rem}
    a{color:LinkText}h1{line-height:1.12}</style><main><h1>${title}</h1>${body}</main></html>`);
}
const back='<p><a href="/">Start again</a></p>';
export function createConsentTest({issuer,clientId,secret}){
  let configuration;
  const flows=new Map();
  function discover(){
    configuration??=oidc.discovery(new URL(issuer),clientId,secret,oidc.ClientSecretBasic(secret)).catch(error=>{
      configuration=null;throw error;
    });
    return configuration;
  }
  return async(req,res,url)=>{
    if(req.method!=='GET')return page(res,405,'Method unavailable',back);
    if(url.pathname==='/')return page(res,200,'Velunivo Consent Test','<p>Review access to Recent neighborhoods and Ride insights with X-Center ID. The test checks the sign-in response and discards tokens.</p><p><a href="/start">Review with X-Center ID</a></p>');
    if(url.pathname==='/start'){
      for(const [ticket,flow] of flows)if(flow.expires<=Date.now())flows.delete(ticket);
      if(flows.size>=200)return page(res,429,'Try again in a few minutes',back);
      const ticket=oidc.randomState(),state=oidc.randomState(),nonce=oidc.randomNonce(),pkce=oidc.randomPKCECodeVerifier();
      const code_challenge=await oidc.calculatePKCECodeChallenge(pkce);
      const authorization=oidc.buildAuthorizationUrl(await discover(),{
        scope:'openid profile app_data',redirect_uri:callback,state,nonce,code_challenge,code_challenge_method:'S256',
      });
      if(flows.size>=200)return page(res,429,'Try again in a few minutes',back);
      flows.set(ticket,{state,nonce,pkce,expires:Date.now()+lifetime});
      res.writeHead(303,{Location:String(authorization),'Cache-Control':'no-store',
        'Set-Cookie':cookieName+'='+ticket+'; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age='+lifetime/1000}).end();
      return;
    }
    if(url.pathname!=='/callback')return page(res,404,'Page unavailable',back);
    const ticket=req.headers.cookie?.split(';').map(part=>part.trim()).find(part=>part.startsWith(cookieName+'='))?.slice(cookieName.length+1);
    const flow=flows.get(ticket);
    if(!flow||flow.expires<=Date.now()||url.searchParams.get('state')!==flow.state)return page(res,400,'Sign-in expired',back);
    flows.delete(ticket);
    res.setHeader('Set-Cookie',cookieName+'=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0');
    if(url.searchParams.has('error'))return page(res,200,'Authorization ended',back);
    await oidc.authorizationCodeGrant(await discover(),url,{
      pkceCodeVerifier:flow.pkce,expectedState:flow.state,expectedNonce:flow.nonce,idTokenExpected:true,
    });
    return page(res,200,'Sign-in verified','<p>X-Center ID returned a valid authorization response. The test did not read your Velunivo records.</p>'+back);
  };
}
