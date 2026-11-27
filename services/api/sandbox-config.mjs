import {createHash,generateKeyPairSync,randomBytes} from 'node:crypto';
import {mkdirSync,readFileSync,readdirSync,realpathSync,writeFileSync} from 'node:fs';
import {dirname,isAbsolute,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const marker='.xcenter-id-sandbox';
const key=()=>randomBytes(32).toString('hex');

function sandboxOrigin(value){
  const url=new URL(value);
  if(url.protocol!=='https:'||url.origin!==value||
      !['id-sandbox.xcenter.it','localhost','127.0.0.1'].includes(url.hostname)){
    throw new Error('Choose the dedicated sandbox HTTPS origin.');
  }
  return url.origin;
}

function stateBinding(config){
  return createHash('sha256').update(JSON.stringify(['xcenter-sandbox-v1',config.issuer,config.storageKey])).digest('hex');
}

export function initializeSandbox({state,output,origin}){
  const issuer=sandboxOrigin(origin);
  if(!isAbsolute(state)||!isAbsolute(output))throw new Error('Use absolute sandbox paths.');
  mkdirSync(state,{recursive:true,mode:0o700});
  mkdirSync(dirname(output),{recursive:true,mode:0o700});
  const realState=realpathSync(state);
  const realOutput=realpathSync(dirname(output));
  if(realOutput===realState||realOutput.startsWith(realState+'/'))throw new Error('Keep issuer keys outside the state directory.');
  if(readdirSync(realState).length)throw new Error('The sandbox needs an empty state directory.');
  const jwk=generateKeyPairSync('rsa',{modulusLength:2048}).privateKey.export({format:'jwk'});
  const config={environment:'sandbox',issuer,storageKey:key(),profileKey:key(),subjectKey:key(),sampleKey:key(),
    cookieKeys:[key()],clients:[],friendRecordPublishers:[],
    jwks:{keys:[{...jwk,kid:'sandbox-'+randomBytes(12).toString('hex'),use:'sig',alg:'RS256'}]}};
  writeFileSync(output,JSON.stringify(config)+'\n',{flag:'wx',mode:0o600});
  writeFileSync(join(realState,marker),stateBinding(config)+'\n',{flag:'wx',mode:0o600});
}

export function validateSandbox(config,env){
  const sandbox=env.AUTHNJS_SANDBOX==='1';
  if(!sandbox){
    if(config?.environment==='sandbox')throw new Error('This issuer configuration is for the sandbox.');
    return false;
  }
  const origin=sandboxOrigin(env.AUTHNJS_ACCOUNT_ORIGIN);
  if(config?.environment!=='sandbox'||config.issuer!==origin||config.clients?.length!==0||
      !/^[a-f0-9]{64}$/.test(config.storageKey??'')){
    throw new Error('Use independently generated sandbox issuer configuration.');
  }
  if(['AUTHNJS_MAIL_CONFIG','AUTHNJS_CONSENT_TEST_CONFIG','AUTHNJS_STORAGE_VOLUMES','AUTHNJS_ADMIN_ACCOUNT_IDS',
      'AUTHNJS_PUBLIC_SAMPLE_APPS','AUTHNJS_LOCAL_SMTP_HOST'].some(name=>env[name])){
    throw new Error('The sandbox cannot use production integrations.');
  }
  if(readFileSync(join(env.AUTHNJS_DATA_DIR,marker),'utf8').trim()!==stateBinding(config)){
    throw new Error('Sandbox data and issuer configuration do not match.');
  }
  return true;
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const [, , origin,state,output]=process.argv;
  initializeSandbox({origin,state,output});
}
