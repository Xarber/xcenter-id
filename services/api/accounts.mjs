import { createPasskeyLabelResolver, passkeyLabel } from './passkey-label.mjs';
import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from 'node:crypto';
import { openEmailVerification } from './email-verification.mjs';
import sharp from 'sharp';
import { ageRangeFromBirthday, validateProfile } from './identity-profile.mjs';
import { DatabaseSync } from 'node:sqlite';
import {
  generateAuthenticationOptions, generateRegistrationOptions,
  verifyAuthenticationResponse, verifyRegistrationResponse,
} from '@simplewebauthn/server';

const token = () => randomBytes(32).toString('base64url');
const digest = (value) => createHash('sha256').update(value).digest('hex');
const now = () => Date.now();
const sessionAge = 12 * 60 * 60 * 1000;
const recentAge = 5 * 60 * 1000;

class AccountError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function requireCondition(condition, status, message) {
  if (!condition) throw new AccountError(status, message);
}

function cookie(req, name) {
  return req.headers.cookie?.split(';').map((part) => part.trim())
    .find((part) => part.startsWith(name + '='))?.slice(name.length + 1) ?? '';
}

function setCookie(res, name, value, maxAge) {
  res.setHeader('Set-Cookie', `${name}=${value}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=${maxAge}`);
}

async function body(req) {
  requireCondition(/^application\/json(?:;|$)/i.test(req.headers['content-type'] ?? ''), 415, 'JSON required.');
  let size = 0;
  const chunks = [];
  for await (const chunk of req.iterator({ destroyOnReturn: false })) {
    size += chunk.length;
    if (size > 65536) {
      req.resume();
      throw new AccountError(413, 'Response is too large.');
    }
    chunks.push(chunk);
  }
  try {
    const value = JSON.parse(Buffer.concat(chunks).toString());
    if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  } catch {}
  throw new AccountError(400, 'Invalid request.');
}

export function createAccounts({ database, origin, sendVerification, profileKey, outboundMail }) {
  const url = new URL(origin);
  if (url.origin !== origin || url.protocol !== 'https:') throw new Error('Set the exact HTTPS account origin');
  const rpID = url.hostname;
  const suggestLabel = createPasskeyLabelResolver();
  const db = new DatabaseSync(database);
  db.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 3000;
    CREATE TABLE IF NOT EXISTS accounts (id TEXT PRIMARY KEY, name TEXT NOT NULL, created INTEGER NOT NULL) STRICT;
    CREATE TABLE IF NOT EXISTS passkeys (id TEXT PRIMARY KEY, owner TEXT NOT NULL REFERENCES accounts(id),
      label TEXT NOT NULL, publicKey BLOB NOT NULL, counter INTEGER NOT NULL, transports TEXT NOT NULL,
      created INTEGER NOT NULL) STRICT;
    CREATE TABLE IF NOT EXISTS account_sessions (hash TEXT PRIMARY KEY, owner TEXT NOT NULL REFERENCES accounts(id),
      created INTEGER NOT NULL, expires INTEGER NOT NULL) STRICT;
    CREATE TABLE IF NOT EXISTS account_devices (
      id TEXT UNIQUE NOT NULL, hash TEXT PRIMARY KEY REFERENCES account_sessions(hash) ON DELETE CASCADE,
      label TEXT NOT NULL
    ) STRICT;
    CREATE TABLE IF NOT EXISTS connected_apps (
      owner TEXT NOT NULL REFERENCES accounts(id), client TEXT NOT NULL, label TEXT NOT NULL,
      updated INTEGER NOT NULL, PRIMARY KEY(owner,client)
    ) STRICT;
    CREATE TABLE IF NOT EXISTS account_entitlements (owner TEXT PRIMARY KEY REFERENCES accounts(id), premium_mail INTEGER NOT NULL) STRICT;
    CREATE TABLE IF NOT EXISTS identity_profiles (
      owner TEXT PRIMARY KEY REFERENCES accounts(id), username TEXT UNIQUE NOT NULL,
      given_name TEXT NOT NULL, surname TEXT NOT NULL, age_range TEXT NOT NULL
    ) STRICT;
    CREATE TABLE IF NOT EXISTS verified_emails (owner TEXT NOT NULL REFERENCES accounts(id),
      address TEXT PRIMARY KEY, verified INTEGER NOT NULL) STRICT;
  `);
  const verification = openEmailVerification(db,{ send:sendVerification, origin });
  const adminIds = new Set((process.env.AUTHNJS_ADMIN_ACCOUNT_IDS ?? '').split(',').map(item=>item.trim()).filter(Boolean));
  const isAdmin = (active) => !!(active && adminIds.has(active.owner));
  const q = (sql) => db.prepare(sql);
  const account = q('SELECT name FROM accounts WHERE id=?');
  const readProfile = q('SELECT username,given_name AS givenName,surname,age_range AS ageRange FROM identity_profiles WHERE owner=?');
  if (profileKey && profileKey.length !== 32) throw new Error('Invalid profile encryption key');
  const profileContext = (owner, username) => Buffer.from(JSON.stringify(['authnjs.profile.v1',owner,username]));
  function profile(owner) {
    const row = readProfile.get(owner);
    const prefix = 'profile-v1:';
    if (!row) return undefined;
    if (!row.givenName.startsWith(prefix)) return row;
    const packed = Buffer.from(row.givenName.slice(prefix.length),'base64url');
    const cipher = createDecipheriv('aes-256-gcm',profileKey,packed.subarray(0,12));
    cipher.setAAD(profileContext(owner,row.username));
    cipher.setAuthTag(packed.subarray(12,28));
    const value = JSON.parse(Buffer.concat([cipher.update(packed.subarray(28)),cipher.final()]).toString());
    return { username:row.username, ...value, ageRange:ageRangeFromBirthday(value.birthday) ?? value.ageRange };
  }
  function writeProfile(owner,{username,givenName,surname,ageRange,birthday,picture}) {
    if (!profileKey) {
      insertProfile.run(owner,username,givenName,surname,ageRange);
      return;
    }
    const nonce = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm',profileKey,nonce);
    cipher.setAAD(profileContext(owner,username));
    const data = Buffer.concat([cipher.update(JSON.stringify({givenName,surname,ageRange,birthday,picture})),cipher.final()]);
    const envelope = Buffer.concat([nonce,cipher.getAuthTag(),data]).toString('base64url');
    insertProfile.run(owner,username,'profile-v1:'+envelope,'','');
  }
  const insertProfile = q(`INSERT INTO identity_profiles VALUES (?,?,?,?,?) ON CONFLICT(owner)
    DO UPDATE SET given_name=excluded.given_name,surname=excluded.surname,age_range=excluded.age_range`);
  const usernameOwner = q('SELECT owner FROM identity_profiles WHERE username=?');
  async function normalizePicture(value) {
    requireCondition(profileKey,503,'Photo uploads are unavailable.');
    requireCondition(typeof value === 'string' && value.length <= 45_000 &&
      /^[A-Za-z0-9+/]+={0,2}$/.test(value),422,'Choose a smaller profile photo.');
    try {
      const bytes = Buffer.from(value,'base64');
      // The web client sends a compact JPEG. Decode only that format and strip metadata.
      if (bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new Error('Expected JPEG');
      const image = await sharp(bytes,{limitInputPixels:1024*1024})
        .resize(256,256,{fit:'cover'}).jpeg({quality:82}).toBuffer();
      return image.toString('base64');
    } catch { throw new AccountError(422,'Could not read this profile photo.'); }
  }
  const reservedNames = (process.env.AUTHNJS_RESERVED_USERNAMES ?? '').split(',').map((name) => name.trim().toLowerCase());
  const keys = q('SELECT id,label,created,transports FROM passkeys WHERE owner=? ORDER BY created,id');
  const key = q('SELECT * FROM passkeys WHERE id=?');
  const emails = q('SELECT address,verified FROM verified_emails WHERE owner=? ORDER BY verified');
  const lookupSession = q('SELECT * FROM account_sessions WHERE hash=? AND expires>?');
  const insertSession = q('INSERT INTO account_sessions VALUES (?,?,?,?)');
  const removeSession = q('DELETE FROM account_sessions WHERE hash=?');
  const challenges = new Map();
  let windowStart = 0;
  let attempts = 0;

  function session(req) {
    const value = cookie(req, '__Host-authnjs');
    return value ? lookupSession.get(digest(value), now()) : undefined;
  }

  function deviceLabel(req) {
    const header=req.headers['user-agent'] ?? '';
    const os=/Android/.test(header)?'Android':/iPhone|iPad/.test(header)?'iPhone or iPad':/Windows/.test(header)?'Windows':/Macintosh/.test(header)?'Mac':/Linux/.test(header)?'Linux':'Unknown device';
    const browser=/Edg\//.test(header)?'Edge':/Chrome|CriOS/.test(header)?'Chrome':/Firefox/.test(header)?'Firefox':/Safari/.test(header)?'Safari':'Browser';
    return browser+' on '+os;
  }
  function login(req,res, owner) {
    const value = token();
    q('DELETE FROM account_sessions WHERE expires<=?').run(now());
    const hash=digest(value);
    insertSession.run(hash, owner, now(), now() + sessionAge);
    q('INSERT INTO account_devices VALUES (?,?,?)').run(randomUUID(),hash,deviceLabel(req));
    setCookie(res, '__Host-authnjs', value, sessionAge / 1000);
  }

  function prepare(res, challenge) {
    const ticket = token();
    challenges.set(ticket, { ...challenge, expires: now() + 120_000 });
    setCookie(res, '__Host-authnjs-flow', ticket, 120);
  }

  function consume(req, action, active) {
    const id = cookie(req, '__Host-authnjs-flow');
    const challenge = challenges.get(id);
    challenges.delete(id);
    requireCondition(challenge && challenge.action === action && challenge.expires > now() &&
      challenge.sessionHash === active?.hash, 400, 'This passkey request expired. Start again.');
    return challenge;
  }

  function limitChallenges() {
    if (now() - windowStart >= 60_000) { windowStart = now(); attempts = 0; }
    requireCondition(++attempts <= 120, 429, 'Too many requests. Try again shortly.');
    for (const [id, flow] of challenges) if (flow.expires <= now()) challenges.delete(id);
  }

  function recent(active) {
    requireCondition(active, 401, 'Sign in first.');
    requireCondition(now() - active.created < recentAge, 403, 'Sign out and sign back in before changing your passkeys.');
  }

  async function route(req, res, pathname) {
    const active = session(req);
    if (req.method === 'GET' && pathname === '/account/me') {
      if (!active) return { account: null };
      const saved = profile(active.owner);
      const { picture, ...details } = saved ?? {};
      return { account: {
        name: account.get(active.owner).name,
        profile: saved ? { ...details, hasPicture:!!picture } : null,
        passkeys: keys.all(active.owner).map(({ id, label, created }) => ({ id, label, created })),
        emails: emails.all(active.owner),
        canSendMail: !!outboundMail,
        mailbox:saved ? saved.username+'@mail.xcenter.it' : null,
        admin:isAdmin(active),
      } };
    }

    if (req.method === 'GET' && pathname === '/account/connected-apps') {
      requireCondition(active,401,'Sign in first.');
      return {apps:q('SELECT client,label,updated FROM connected_apps WHERE owner=? ORDER BY updated DESC LIMIT 100').all(active.owner)};
    }
    if (req.method === 'GET' && pathname === '/account/devices') {
      requireCondition(active,401,'Sign in first.');
      const sessions=q('SELECT hash,created FROM account_sessions WHERE owner=? AND expires>? ORDER BY created DESC').all(active.owner,now());
      const register=q('INSERT OR IGNORE INTO account_devices VALUES (?,?,?)');
      const lookup=q('SELECT id,label FROM account_devices WHERE hash=?');
      return {devices:sessions.map(row=>{
        register.run(randomUUID(),row.hash,row.hash===active.hash?deviceLabel(req):'Previously signed-in browser');
        return {...lookup.get(row.hash),created:row.created,current:row.hash===active.hash};
      })};
    }
    if (req.method === 'GET' && pathname === '/account/admin/accounts') {
      requireCondition(isAdmin(active),403,'Administrator access is required.');
      return {accounts:q(`SELECT p.username,coalesce(e.premium_mail,0) AS premium FROM identity_profiles p
        LEFT JOIN account_entitlements e ON e.owner=p.owner ORDER BY p.username LIMIT 500`).all()
        .map(row=>({username:row.username,premium:!!row.premium}))};
    }
    if (req.method === 'GET' && pathname === '/account/avatar') {
      const picture = active && profile(active.owner)?.picture;
      requireCondition(picture,404,'Profile photo unavailable.');
      return Buffer.from(picture,'base64');
    }
    requireCondition(req.method === 'POST', 405, 'Method unavailable.');
    requireCondition(req.headers.origin === origin, 403, 'Invalid origin.');
    const input = await body(req);
    if (pathname === '/account/logout') {
      if (active) removeSession.run(active.hash);
      setCookie(res, '__Host-authnjs', '', 0);
      return { ok: true };
    }
    if (pathname === '/account/devices/revoke') {
      requireCondition(active,401,'Sign in first.');
      const changed=q(`DELETE FROM account_sessions WHERE owner=? AND hash<>? AND
        hash=(SELECT hash FROM account_devices WHERE id=?)`).run(active.owner,active.hash,input.id??'');
      requireCondition(changed.changes===1,404,'Session unavailable.');
      return {ok:true};
    }
    if (pathname === '/account/admin/premium') {
      requireCondition(isAdmin(active),403,'Administrator access is required.');
      recent(active);
      const selected=usernameOwner.get(input.username??'');
      requireCondition(selected&&typeof input.enabled==='boolean',422,'Account or entitlement unavailable.');
      q(`INSERT INTO account_entitlements VALUES(?,?) ON CONFLICT(owner)
        DO UPDATE SET premium_mail=excluded.premium_mail`).run(selected.owner,Number(input.enabled));
      return {ok:true};
    }
    if (pathname === '/account/mail/send') {
      requireCondition(active,401,'Sign in first.');
      const identity = profile(active.owner);
      requireCondition(outboundMail && identity,503,'Mail sending is unavailable.');
      const result = await outboundMail.send(active.owner,identity.username,input);
      if (!result.ok) throw new AccountError(result.status,result.error);
      return result;
    }
    if (pathname === '/account/email') {
      requireCondition(active, 401, 'Sign in first.');
      const outcome = await verification.start(active.owner,input.email);
      if (!outcome.ok) throw new AccountError(outcome.status,outcome.error);
      return outcome;
    }
    if (pathname === '/account/email/confirm') {
      requireCondition(active,401,'Sign in first.');
      requireCondition(verification.confirm(active.owner,input.token),400,'The verification link was invalid, expired or already used.');
      return { ok:true };
    }
    if (pathname === '/account/profile') {
      requireCondition(active,401,'Sign in first.');
      requireCondition(profileKey,503,'Profile editing requires encrypted account storage.');
      const existing = profile(active.owner);
      const candidate = validateProfile({ ...input, username:existing?.username ?? input.username },reservedNames);
      requireCondition(!candidate.error,422,candidate.error);
      let picture = existing?.picture;
      if (input.picture === null) picture = undefined;
      else if (input.picture !== undefined) picture = await normalizePicture(input.picture);
      const owner = usernameOwner.get(candidate.username)?.owner;
      requireCondition(!owner || owner === active.owner,409,'This username is unavailable.');
      writeProfile(active.owner,{...candidate,picture});
      return { ok:true };
    }
    if (pathname === '/account/passkey/rename') {
      recent(active);
      const label = passkeyLabel(input.name);
      requireCondition(label, 422, 'Enter a passkey name of up to 64 characters.');
      requireCondition(typeof input.id === 'string', 400, 'Select a passkey.');
      const updated = q('UPDATE passkeys SET label=? WHERE id=? AND owner=?').run(label, input.id, active.owner);
      requireCondition(updated.changes === 1, 404, 'Passkey not found.');
      return { ok: true };
    }
    if (pathname === '/account/passkey/remove') {
      recent(active);
      const removed = q(`DELETE FROM passkeys WHERE id=? AND owner=?
        AND (SELECT count(*) FROM passkeys WHERE owner=?) > 1`).run(input.id ?? '', active.owner, active.owner);
      requireCondition(removed.changes === 1, 409, 'Keep at least one passkey on your account.');
      q('DELETE FROM account_sessions WHERE owner=? AND hash<>?').run(active.owner, active.hash);
      return { ok: true };
    }

    const action = pathname.split('/')[2];
    requireCondition(['signup', 'login', 'add'].includes(action), 404, 'Account route unavailable.');
    if (action === 'add') recent(active);
    else requireCondition(!active, 409, 'Sign out before starting a new account or sign-in.');
    if (pathname.endsWith('/options')) {
      limitChallenges();
      if (action === 'login') {
        const options = await generateAuthenticationOptions({ rpID, userVerification: 'required' });
        const username = typeof input.username === 'string' ? input.username.trim().toLowerCase() : '';
        requireCondition(!username || /^[a-z][a-z0-9]{2,23}$/.test(username),422,'Enter a valid X-Center username.');
        prepare(res, { action, username, expected: options.challenge });
        return options;
      }
      const name = passkeyLabel(input.name);
      requireCondition(input.name === undefined || name, 422, 'Enter a passkey name of up to 64 characters.');
      const owner = active?.owner ?? randomUUID();
      const options = await generateRegistrationOptions({
        rpName: 'X-Center ID', rpID, userID: new TextEncoder().encode(owner),
        userName: profile(owner)?.username ?? (active ? account.get(owner).name : 'xcenter-' + owner.slice(0,8)),
        userDisplayName: active ? account.get(owner).name : 'New X-Center ID',
        attestationType: 'none',
        excludeCredentials: keys.all(owner).map(({ id, transports }) => ({ id, transports: JSON.parse(transports) })),
        authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
      });
      prepare(res, { action, owner, name, expected: options.challenge, sessionHash: active?.hash });
      return options;
    }
    requireCondition(pathname.endsWith('/finish'), 404, 'Account route unavailable.');
    const challenge = consume(req, action, active);
    requireCondition(input.response && typeof input.response.id === 'string', 400, 'Invalid passkey response.');
    if (action === 'login') {
      const saved = key.get(input.response.id);
      requireCondition(saved, 401, 'Could not sign in with this passkey.');
      const handle = input.response.response?.userHandle;
      requireCondition(!handle || handle === Buffer.from(saved.owner).toString('base64url'), 401, 'Could not sign in with this passkey.');
      const result = await verifyAuthenticationResponse({
        response: input.response, expectedChallenge: challenge.expected, expectedOrigin: origin, expectedRPID: rpID,
        requireUserVerification: true, credential: { id: saved.id, publicKey: saved.publicKey,
          counter: saved.counter, transports: JSON.parse(saved.transports) },
      }).catch(() => null);
      requireCondition(result?.verified && (!challenge.username || profile(saved.owner)?.username === challenge.username),
        401, 'Could not sign in with this passkey and username.');
      requireCondition(q('UPDATE passkeys SET counter=? WHERE id=? AND counter=?')
        .run(result.authenticationInfo.newCounter, saved.id, saved.counter).changes === 1, 409, 'Sign-in changed. Try again.');
      login(req,res,saved.owner);
      return { ok: true };
    }
    const result = await verifyRegistrationResponse({
      response: input.response, expectedChallenge: challenge.expected, expectedOrigin: origin,
      expectedRPID: rpID, requireUserVerification: true,
    }).catch(() => null);
    requireCondition(result?.verified && result.registrationInfo, 400, 'Could not register this passkey.');
    const { aaguid, credential } = result.registrationInfo;
    const label = challenge.name ?? await suggestLabel({ aaguid, transports: credential.transports });
    db.exec('BEGIN IMMEDIATE');
    try {
      if (action === 'signup') q('INSERT INTO accounts VALUES (?,?,?)').run(challenge.owner,'X-Center ID',now());
      requireCondition(keys.all(challenge.owner).length < 20, 409, 'Passkey limit reached.');
      q('INSERT INTO passkeys VALUES (?,?,?,?,?,?,?)').run(credential.id, challenge.owner,
        label, credential.publicKey, credential.counter,
        JSON.stringify(credential.transports ?? []), now());
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      if (error.code?.startsWith('ERR_SQLITE_CONSTRAINT')) throw new AccountError(409, 'This passkey is already registered.');
      throw error;
    }
    if (action === 'signup') login(req,res,challenge.owner);
    return { ok:true, passkey:{ id:credential.id, label } };
  }

  async function handle(req, res, pathname) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    try {
      const result = await route(req,res,pathname);
      if (Buffer.isBuffer(result)) {
        res.setHeader('Content-Type','image/jpeg');
        res.setHeader('Cross-Origin-Resource-Policy','same-origin');
        res.end(result);
      } else res.end(JSON.stringify(result));
    } catch (error) {
      res.statusCode = error instanceof AccountError ? error.status : 500;
      if (res.statusCode === 500) console.error('account_request_failed', error?.constructor?.name);
      res.end(JSON.stringify({ error: error instanceof AccountError ? error.message : 'Account service error.' }));
    }
  }
  return {
    handle,
    current: (req) => session(req),
    rememberApp(owner,client,label) {
      q(`INSERT INTO connected_apps VALUES(?,?,?,?) ON CONFLICT(owner,client)
        DO UPDATE SET label=excluded.label,updated=excluded.updated`).run(owner,client,label,Date.now());
    },
    premiumEligible: (owner) => q('SELECT premium_mail FROM account_entitlements WHERE owner=?').get(owner)?.premium_mail===1,
    identity(owner) {
      const found = profile(owner);
      return found ? { username:found.username, givenName:found.givenName,surname:found.surname,
        ageRange:found.ageRange, emails:emails.all(owner) } : null;
    },
  };
}
