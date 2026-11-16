import { generateKeyPairSync, randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';

const [origin, output] = process.argv.slice(2);
if (!origin || !output || new URL(origin).origin !== origin || !origin.startsWith('https://')) {
  throw new Error('Use generate-identity-config.mjs <https-origin> <new-config-path>');
}
const secret = () => randomBytes(32).toString('hex');
const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 3072 });
writeFileSync(output, JSON.stringify({
  storageKey: secret(),
  subjectKey: secret(),
  sampleKey: secret(),
  profileKey: secret(),
  cookieKeys: [secret()],
  jwks: { keys:[{ ...privateKey.export({ format:'jwk' }), alg:'RS256', use:'sig', kid:randomBytes(16).toString('hex') }] },
  clients: [
    ['places-demo','Places Notebook'],['trips-demo','Trip Planner'],
  ].map(([client_id,client_name]) => ({
    client_id,client_name,client_secret:secret(),redirect_uris:[`${origin}/samples/${client_id}/callback`],
  })),
},null,2)+'\n',{flag:'wx', mode:0o600});
