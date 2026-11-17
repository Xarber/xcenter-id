import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createAccounts } from './accounts.mjs';

const [owner, from, to] = process.argv.slice(2);
const { AUTHNJS_OIDC_CONFIG: configPath, AUTHNJS_DATA_DIR: state, AUTHNJS_ACCOUNT_ORIGIN: origin } = process.env;
if (!owner || !from || !to || !configPath || !state || !origin) throw new Error('Account rename requires the owner and deployment configuration');
const config = JSON.parse(readFileSync(configPath,'utf8'));
const accounts = createAccounts({
  database:join(state,'accounts.sqlite'),origin,profileKey:Buffer.from(config.profileKey,'hex'),
});
if (!accounts.renameStoredUsername(owner,from,to)) throw new Error('Account or destination no longer matches the expected state');
console.log('Account username changed and encrypted profile verified.');
