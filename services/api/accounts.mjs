import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from 'node:crypto';
import { openEmailVerification } from './email-verification.mjs';
import { validateProfile } from './identity-profile.mjs';
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

export function createAccounts({ database, origin, sendVerification, profileKey }) {
  const url = new URL(origin);
  if (url.origin !== origin || url.protocol !== 'https:') throw new Error('Set the exact HTTPS account origin');
  const rpID = url.hostname;
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
    CREATE TABLE IF NOT EXISTS identity_profiles (
      owner TEXT PRIMARY KEY REFERENCES accounts(id), username TEXT UNIQUE NOT NULL,
      given_name TEXT NOT NULL, surname TEXT NOT NULL, age_range TEXT NOT NULL
    ) STRICT;
    CREATE TABLE IF NOT EXISTS verified_emails (owner TEXT NOT NULL REFERENCES accounts(id),
      address TEXT PRIMARY KEY, verified INTEGER NOT NULL) STRICT;
  `);
  const verification = openEmailVerification(db,{ send:sendVerification, origin });
  const q = (sql) => db.prepare(sql);
  const account = q('SELECT name FROM accounts WHERE id=?');
  const readProfile = q('SELECT username,given_name AS givenName,surname,age_range AS ageRange FROM identity_profiles WHERE owner=?');
  if (profileKey && profileKey.length !== 32) throw new Error('Invalid profile encryption key');
  const profileContext = (owner, username) => Buffer.from(JSON.stringify(['authnjs.profile.v1',owner,username]));
  function profile(owner) {
    const row = readProfile.get(owner);
    const prefix = 'profile-v1:';
    if (!row?.givenName.startsWith(prefix)) return row;
    const packed = Buffer.from(row.givenName.slice(prefix.length),'base64url');
    const cipher = createDecipheriv('aes-256-gcm',profileKey,packed.subarray(0,12));
    cipher.setAAD(profileContext(owner,row.username));
    cipher.setAuthTag(packed.subarray(12,28));
    return {username:row.username,...JSON.parse(Buffer.concat([cipher.update(packed.subarray(28)),cipher.final()]).toString())};
  }
  function writeProfile(owner,{username,givenName,surname,ageRange}) {
    if (!profileKey) {
      insertProfile.run(owner,username,givenName,surname,ageRange);
      return;
    }
    const nonce = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm',profileKey,nonce);
    cipher.setAAD(profileContext(owner,username));
    const data = Buffer.concat([cipher.update(JSON.stringify({givenName,surname,ageRange})),cipher.final()]);
    const envelope = Buffer.concat([nonce,cipher.getAuthTag(),data]).toString('base64url');
    insertProfile.run(owner,username,'profile-v1:'+envelope,'','');
  }
  const insertProfile = q('INSERT INTO identity_profiles VALUES (?,?,?,?,?)');
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

  function login(res, owner) {
    const value = token();
    q('DELETE FROM account_sessions WHERE expires<=?').run(now());
    insertSession.run(digest(value), owner, now(), now() + sessionAge);
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
      return { account: {
        name: account.get(active.owner).name,
        profile: profile(active.owner) ?? null,
        passkeys: keys.all(active.owner).map(({ id, label, created }) => ({ id, label, created })),
        emails: emails.all(active.owner),
      } };
    }

    requireCondition(req.method === 'POST', 405, 'Method unavailable.');
    requireCondition(req.headers.origin === origin, 403, 'Invalid origin.');
    const input = await body(req);
    if (pathname === '/account/logout') {
      if (active) removeSession.run(active.hash);
      setCookie(res, '__Host-authnjs', '', 0);
      return { ok: true };
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
      recent(active);
      requireCondition(!profile(active.owner),409,'This account already has a profile.');
      const candidate = validateProfile(input,reservedNames);
      requireCondition(!candidate.error,422,candidate.error);
      requireCondition(!q('SELECT 1 FROM identity_profiles WHERE username=?').get(candidate.username),409,'This username is unavailable.');
      writeProfile(active.owner,candidate);
      return { ok:true };
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
        prepare(res, { action, expected: options.challenge });
        return options;
      }
      const name = typeof input.name === 'string' ? input.name.trim() : '';
      requireCondition(name.length >= 1 && name.length <= 64 && !/[\u0000-\u001f\u007f]/.test(name), 422,
        action === 'signup' ? 'Enter an account name.' : 'Enter a passkey name.');
      let newProfile;
      if (action === 'signup') {
        newProfile = validateProfile(input, reservedNames);
        requireCondition(!newProfile.error, 422, newProfile.error);
        requireCondition(!q('SELECT 1 FROM identity_profiles WHERE username=?').get(newProfile.username), 409, 'This username is unavailable.');
      }
      const owner = active?.owner ?? randomUUID();
      const options = await generateRegistrationOptions({
        rpName: 'X-Center ID', rpID, userID: new TextEncoder().encode(owner),
        userName: newProfile?.username ?? profile(owner)?.username ?? account.get(owner).name,
        attestationType: 'none',
        excludeCredentials: keys.all(owner).map(({ id, transports }) => ({ id, transports: JSON.parse(transports) })),
        authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
      });
      prepare(res, { action, owner, name, newProfile, expected: options.challenge, sessionHash: active?.hash });
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
      requireCondition(result?.verified, 401, 'Could not sign in with this passkey.');
      requireCondition(q('UPDATE passkeys SET counter=? WHERE id=? AND counter=?')
        .run(result.authenticationInfo.newCounter, saved.id, saved.counter).changes === 1, 409, 'Sign-in changed. Try again.');
      login(res, saved.owner);
      return { ok: true };
    }
    const result = await verifyRegistrationResponse({
      response: input.response, expectedChallenge: challenge.expected, expectedOrigin: origin,
      expectedRPID: rpID, requireUserVerification: true,
    }).catch(() => null);
    requireCondition(result?.verified && result.registrationInfo, 400, 'Could not register this passkey.');
    const { credential } = result.registrationInfo;
    db.exec('BEGIN IMMEDIATE');
    try {
      if (action === 'signup') {
        const { username } = challenge.newProfile;
        q('INSERT INTO accounts VALUES (?,?,?)').run(challenge.owner,username,now());
        requireCondition(!q('SELECT 1 FROM identity_profiles WHERE username=?').get(username), 409, 'This username is unavailable.');
        writeProfile(challenge.owner,challenge.newProfile);
      }
      requireCondition(keys.all(challenge.owner).length < 20, 409, 'Passkey limit reached.');
      q('INSERT INTO passkeys VALUES (?,?,?,?,?,?,?)').run(credential.id, challenge.owner,
        action === 'signup' ? 'First passkey' : challenge.name, credential.publicKey, credential.counter,
        JSON.stringify(credential.transports ?? []), now());
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      if (error.code?.startsWith('ERR_SQLITE_CONSTRAINT')) throw new AccountError(409, 'This passkey is already registered.');
      throw error;
    }
    if (action === 'signup') login(res, challenge.owner);
    return { ok: true };
  }

  async function handle(req, res, pathname) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    try {
      res.end(JSON.stringify(await route(req, res, pathname)));
    } catch (error) {
      res.statusCode = error instanceof AccountError ? error.status : 500;
      if (res.statusCode === 500) console.error('account_request_failed', error?.constructor?.name);
      res.end(JSON.stringify({ error: error instanceof AccountError ? error.message : 'Account service error.' }));
    }
  }
  return {
    handle,
    current: (req) => session(req),
    identity(owner) {
      const found = profile(owner);
      return found ? { ...found, emails: emails.all(owner) } : null;
    },
  };
}
