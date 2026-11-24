import {openMailCredentials} from './mail-credentials.mjs';
import { openInboundVerification } from './inbound-verification.mjs';
import { openEmailSignIn } from './email-signin.mjs';
import { openNativeSession } from './native-session.mjs';
import { createPasskeyLabelResolver, passkeyLabel } from './passkey-label.mjs';
import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from 'node:crypto';
import { openEmailVerification } from './email-verification.mjs';
import sharp from 'sharp';
import {isUsername, ageRangeFromBirthday, validateProfile, validateUsername } from './identity-profile.mjs';
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
const standardStorage=10*1024**2;

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
  const header=`${name}=${value}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=${maxAge}`;
  const previous=res.getHeader('Set-Cookie');
  res.setHeader('Set-Cookie',previous?[...Array.isArray(previous)?previous:[previous],header]:header);
}

async function body(req, limit=65536) {
  requireCondition(/^application\/json(?:;|$)/i.test(req.headers['content-type'] ?? ''), 415, 'JSON required.');
  let size = 0;
  const chunks = [];
  for await (const chunk of req.iterator({ destroyOnReturn: false })) {
    size += chunk.length;
    if (size > limit) {
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

export function createAccounts({ database, origin, sendVerification, profileKey, outboundMail, canReceiveMail = false, externalMail = false, inboundVerification=false,appBrand=()=>null,purgeAccount=()=>{}, extraStorage=()=>0, mailboxNameTaken=()=>false }) {
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
    CREATE TABLE IF NOT EXISTS app_link_grants (
      owner TEXT NOT NULL, client TEXT NOT NULL, grant_id TEXT NOT NULL UNIQUE,
      PRIMARY KEY(owner,client,grant_id),
      FOREIGN KEY(owner,client) REFERENCES connected_apps(owner,client) ON DELETE CASCADE
    ) STRICT;
    CREATE TABLE IF NOT EXISTS app_disconnects (
      owner TEXT NOT NULL REFERENCES accounts(id), client TEXT NOT NULL, PRIMARY KEY(owner,client)
    ) STRICT;
    CREATE TABLE IF NOT EXISTS account_entitlements (owner TEXT PRIMARY KEY REFERENCES accounts(id), premium_mail INTEGER NOT NULL) STRICT;
    CREATE TABLE IF NOT EXISTS identity_profiles (
      owner TEXT PRIMARY KEY REFERENCES accounts(id), username TEXT UNIQUE NOT NULL,
      given_name TEXT NOT NULL, surname TEXT NOT NULL, age_range TEXT NOT NULL
    ) STRICT;
    CREATE TABLE IF NOT EXISTS signup_usernames (
      owner TEXT PRIMARY KEY REFERENCES accounts(id), username TEXT UNIQUE NOT NULL, expires INTEGER NOT NULL
    ) STRICT;
    CREATE TABLE IF NOT EXISTS account_storage_caps(owner TEXT PRIMARY KEY REFERENCES accounts(id),bytes INTEGER NOT NULL) STRICT;
    CREATE TABLE IF NOT EXISTS verified_emails (owner TEXT NOT NULL REFERENCES accounts(id),
      address TEXT PRIMARY KEY, verified INTEGER NOT NULL) STRICT;
    CREATE TABLE IF NOT EXISTS account_restrictions(owner TEXT PRIMARY KEY REFERENCES accounts(id),
      status TEXT NOT NULL CHECK(status IN ('locked','deleted'))) STRICT;
    CREATE TABLE IF NOT EXISTS mailbox_aliases(local TEXT PRIMARY KEY,owner TEXT NOT NULL REFERENCES accounts(id),client TEXT,
      active INTEGER NOT NULL DEFAULT 1,created INTEGER NOT NULL,UNIQUE(owner,client)) STRICT;
    CREATE TABLE IF NOT EXISTS account_flags(owner TEXT PRIMARY KEY REFERENCES accounts(id),
      verified INTEGER NOT NULL DEFAULT 0, admin INTEGER NOT NULL DEFAULT 0, public_fields TEXT NOT NULL DEFAULT '[]') STRICT;
    CREATE TABLE IF NOT EXISTS retired_usernames(username TEXT PRIMARY KEY) STRICT;
    CREATE TABLE IF NOT EXISTS account_deletion_jobs(owner TEXT PRIMARY KEY) STRICT;
    CREATE TABLE IF NOT EXISTS account_admin_events(id TEXT PRIMARY KEY, actor TEXT NOT NULL,
      target TEXT NOT NULL, action TEXT NOT NULL, created INTEGER NOT NULL) STRICT;
    CREATE TABLE IF NOT EXISTS username_change_requests(owner TEXT PRIMARY KEY REFERENCES accounts(id),
      id TEXT UNIQUE NOT NULL, previous TEXT NOT NULL, proposed TEXT NOT NULL, expires INTEGER NOT NULL,
      confirmed INTEGER NOT NULL DEFAULT 0) STRICT;
    CREATE TABLE IF NOT EXISTS session_confirmations(hash TEXT PRIMARY KEY REFERENCES account_sessions(hash) ON DELETE CASCADE,
      expires INTEGER NOT NULL) STRICT;
    CREATE TABLE IF NOT EXISTS native_confirmations(code TEXT PRIMARY KEY, hash TEXT NOT NULL REFERENCES account_sessions(hash) ON DELETE CASCADE,
      expires INTEGER NOT NULL) STRICT;
  `);
  const mailCredentials=openMailCredentials(database);
  const inbound=openInboundVerification(database,{enabled:inboundVerification});
  const native = openNativeSession(db);
  const emailSignIn=openEmailSignIn(db,{send:sendVerification,secret:profileKey??randomBytes(32)});
  const verification = openEmailVerification(db,{ send:sendVerification, origin });
  const adminIds = new Set((process.env.AUTHNJS_ADMIN_ACCOUNT_IDS ?? '').split(',').map(item=>item.trim()).filter(Boolean));
  const isAdmin = (active) => !!(active && (adminIds.has(active.owner)||db.prepare('SELECT admin FROM account_flags WHERE owner=?').get(active.owner)?.admin===1));
  const q = (sql) => db.prepare(sql);
  const restriction=q('SELECT status FROM account_restrictions WHERE owner=?');
  const available=owner=>!!account.get(owner)&&!restriction.get(owner);
  const badges=owner=>({verified:q('SELECT verified FROM account_flags WHERE owner=?').get(owner)?.verified===1,admin:isAdmin({owner})});
  const linkedAppBrand=app=>{
    const brand=appBrand(app.client);
    return {...app,label:brand?.name??app.label,icon:brand?.iconUrl??brand?.icon??null,verified:!!brand?.verified,description:brand?.description??''};
  };
  const storageCapacity=owner=>q('SELECT bytes FROM account_storage_caps WHERE owner=?').get(owner)?.bytes??standardStorage;
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
  const profileBytes=q(`SELECT length(CAST(username AS BLOB))+length(CAST(given_name AS BLOB))+
    length(CAST(surname AS BLOB))+length(CAST(age_range AS BLOB)) AS bytes FROM identity_profiles WHERE owner=?`);
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
    DO UPDATE SET username=excluded.username,given_name=excluded.given_name,surname=excluded.surname,age_range=excluded.age_range`);
  function accountUsage(owner) {
    const bytes=(query)=>q(query).get(owner).bytes;
    return {
      account:(profileBytes.get(owner)?.bytes??0)+bytes('SELECT total(length(CAST(address AS BLOB))+8) AS bytes FROM verified_emails WHERE owner=?'),
      security:bytes('SELECT total(length(id)+length(CAST(label AS BLOB))+length(publicKey)+length(transports)+16) AS bytes FROM passkeys WHERE owner=?'),
      apps:bytes('SELECT total(length(client)+length(CAST(label AS BLOB))+8) AS bytes FROM connected_apps WHERE owner=?'),
    };
  }
  const usernameOwner = q('SELECT owner FROM identity_profiles WHERE username=?');
  const reservedOwner = q('SELECT owner FROM signup_usernames WHERE username=? AND expires>?');
  const reservedUsername = q('SELECT username FROM signup_usernames WHERE owner=? AND expires>?');
  function ensureAvailable(name, owner) {
    requireCondition(!mailboxNameTaken(name)&&!q('SELECT 1 FROM mailbox_aliases WHERE local=?').get(name),409,'This username is unavailable.');
    requireCondition(!q('SELECT 1 FROM retired_usernames WHERE username=?').get(name),409,'This username is unavailable.');
    const existing = usernameOwner.get(name)?.owner ?? reservedOwner.get(name,now())?.owner;
    requireCondition(!existing || existing === owner,409,'This username is unavailable.');
  }
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
  const lookupSession = q(`SELECT * FROM account_sessions WHERE hash=? AND expires>?
    AND owner NOT IN (SELECT owner FROM account_restrictions)`);
  const lookupPreservedSession=q(`SELECT * FROM account_sessions WHERE hash=? AND expires>? AND
    owner NOT IN (SELECT owner FROM account_restrictions WHERE status='deleted')`);
  const insertSession = q('INSERT INTO account_sessions VALUES (?,?,?,?)');
  const removeSession = q('DELETE FROM account_sessions WHERE hash=?');
  const challenges = new Map();
  let windowStart = 0;
  let attempts = 0;

  function nativeRequest(req) {
    return !req.headers.origin && !req.headers.cookie && req.headers['x-authnjs-native']==='account-manager';
  }
  function session(req,includeLocked=false) {
    const lookup=includeLocked?lookupPreservedSession:lookupSession;
    const bearer = nativeRequest(req) && /^Bearer ([A-Za-z0-9_-]{43})$/.exec(req.headers.authorization ?? '')?.[1];
    if (bearer) {
      const hash=digest(bearer);
      return native.accepts(hash) ? lookup.get(hash,now()) : undefined;
    }
    const value = cookie(req, '__Host-authnjs');
    return value ? lookup.get(digest(value), now()) : undefined;
  }

  function allowsMutation(req) {
    return req.headers.origin === origin || (nativeRequest(req) && !!session(req));
  }

  function deviceLabel(req) {
    const header=req.headers['user-agent'] ?? '';
    const os=/Android/.test(header)?'Android':/iPhone|iPad/.test(header)?'iPhone or iPad':/Windows/.test(header)?'Windows':/Macintosh/.test(header)?'Mac':/Linux/.test(header)?'Linux':'Unknown device';
    const browser=/Edg\//.test(header)?'Edge':/Chrome|CriOS/.test(header)?'Chrome':/Firefox/.test(header)?'Firefox':/Safari/.test(header)?'Safari':'Browser';
    return browser+' on '+os;
  }
  const browserCookie='__Host-authnjs';
  const switcherCookie='__Host-authnjs-switcher';
  function browserAccounts(req){
    const values=[cookie(req,browserCookie),...cookie(req,switcherCookie).split('.')];
    const seen=new Set();
    return values.slice(0,3).flatMap(value=>{
      const current=/^[A-Za-z0-9_-]{43}$/.test(value)&&lookupPreservedSession.get(digest(value),now());
      if(!current||seen.has(current.owner))return [];
      seen.add(current.owner);
      return [{...current,value}];
    });
  }
  function browserAccountOptions(req){
    const current=session(req,true);
    const entries=browserAccounts(req);
    return {
      canAdd:entries.length<3,
      accounts:entries.flatMap((entry,slot)=>{
        const person=profile(entry.owner);
        return person?[{slot,current:entry.hash===current?.hash,username:person.username,givenName:person.givenName,
          surname:person.surname,hasPicture:!!person.picture}]:[];
      }),
    };
  }
  function activateBrowserAccount(req,res,slot){
    if(nativeRequest(req)||req.headers.origin!==origin||!Number.isInteger(slot))return false;
    const entries=browserAccounts(req);
    const selected=entries[slot];
    if(!selected)return false;
    setBrowserAccounts(res,selected.value,entries.filter(entry=>entry!==selected));
    return true;
  }

  function setBrowserAccounts(res,activeValue,others){
    setCookie(res,browserCookie,activeValue,activeValue?sessionAge/1000:0);
    const saved=others.slice(0,activeValue?2:3).map(entry=>entry.value).join('.');
    setCookie(res,switcherCookie,saved,saved?sessionAge/1000:0);
  }
  function allowNewSignIn(req,active,input){
    requireCondition(!active||(input.addAccount===true&&!nativeRequest(req)&&req.headers.origin===origin&&
      req.headers['x-authnjs-request']==='account-consent'),409,'Use Add another account while signed in.');
  }
  function checkBrowserCapacity(req,owner){
    const entries=browserAccounts(req);
    requireCondition(entries.length<3||entries.some(entry=>entry.owner===owner),409,'Sign out of one account before adding another.');
    return entries;
  }

  function deleteIdentity(owner,username){
    q(`INSERT INTO account_restrictions VALUES(?,'deleted') ON CONFLICT(owner) DO UPDATE SET status='deleted'`).run(owner);
    q('INSERT OR IGNORE INTO retired_usernames VALUES(?)').run(username);
    for(const table of ['passkeys','account_sessions','email_signins','connected_apps','app_link_grants','app_disconnects','account_entitlements',
      'account_storage_caps','mail_credentials','account_email_addresses','inbound_verification_results','account_flags','identity_profiles',
      'signup_usernames','verified_emails','email_verifications','username_change_requests','inbound_verifications','inbound_verification_rates']){
      q('DELETE FROM '+table+' WHERE owner=?').run(owner);
    }
    q('UPDATE mailbox_aliases SET active=0 WHERE owner=?').run(owner);
    q("UPDATE accounts SET name='Deleted account' WHERE id=?").run(owner);
    q('INSERT OR IGNORE INTO account_deletion_jobs VALUES(?)').run(owner);
  }
  function finishDeletion(owner){
    try{
      purgeAccount(owner);
      q('DELETE FROM account_deletion_jobs WHERE owner=?').run(owner);
    }catch(error){console.error('account_deletion_cleanup_pending',error?.constructor?.name);}
  }

  function login(req,res, owner, nativeSource,allowLocked=false) {
    requireCondition(available(owner)||allowLocked&&restriction.get(owner)?.status==='locked',401,'Sign-in is unavailable.');
    const previous=nativeSource?[]:checkBrowserCapacity(req,owner);
    const value = token();
    q('DELETE FROM account_sessions WHERE expires<=?').run(now());
    const hash=digest(value);
    const created=nativeSource?.created ?? now();
    insertSession.run(hash,owner,created,nativeSource?.expires ?? created+sessionAge);
    if(nativeSource) native.bind(hash);
    const nativePlatform = req.headers['x-authnjs-device-platform'];
    const label = nativeSource ? (nativePlatform==='ios'?'X-Center ID on iPhone or iPad'
      :nativePlatform==='android'?'X-Center ID on Android':'X-Center ID app') : deviceLabel(req);
    q('INSERT INTO account_devices VALUES (?,?,?)').run(randomUUID(),hash,label);
    if(!nativeSource){
      for(const entry of previous)if(entry.owner===owner)removeSession.run(entry.hash);
      setBrowserAccounts(res,value,previous.filter(entry=>entry.owner!==owner));
    }
    return value;
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
      (challenge.target&&action==='reauth'||challenge.sessionHash===active?.hash), 400, 'This passkey request expired. Start again.');
    return challenge;
  }

  function limitChallenges() {
    if (now() - windowStart >= 60_000) { windowStart = now(); attempts = 0; }
    requireCondition(++attempts <= 120, 429, 'Too many requests. Try again shortly.');
    for (const [id, flow] of challenges) if (flow.expires <= now()) challenges.delete(id);
  }

  function nativeConfirmation(request){
    if(typeof request!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(request))return null;
    const row=q(`SELECT s.hash,s.owner FROM native_confirmations c JOIN account_sessions s ON c.hash=s.hash
      WHERE c.code=? AND c.expires>? AND s.expires>?`).get(digest(request),now(),now());
    return row&&native.accepts(row.hash)&&available(row.owner)?row:null;
  }

  function recent(active) {
    requireCondition(active, 401, 'Sign in first.');
    requireCondition(confirmed(active), 403, 'Confirm your identity to continue.');
  }
  function confirmed(active) {
    return !!active&&(now()-active.created<recentAge||
      !!q('SELECT 1 FROM session_confirmations WHERE hash=? AND expires>?').get(active.hash,now()));
  }

  async function route(req, res, pathname) {
    const active = session(req);
    if(req.method==='GET'&&pathname==='/account/session/access'){requireCondition(active,401,'Sign in first.');return {confirmed:confirmed(active)};}
    if(req.method==='GET'&&pathname==='/account/admin/access'){
      requireCondition(isAdmin(active),403,'Administrator access is required.');
      return {authorized:confirmed(active)};
    }
    if(pathname.startsWith('/account/admin/')){
      requireCondition(isAdmin(active),403,'Administrator access is required.');
      recent(active);
    }
    if(req.method==='GET'&&pathname==='/account/switcher'){
      requireCondition(!nativeRequest(req),403,'Use the device account switcher.');
      return browserAccountOptions(req);
    }
    const switcherPhoto=/^\/account\/switcher\/avatar\/([012])$/.exec(pathname)?.[1];
    if(req.method==='GET'&&switcherPhoto){
      const entry=browserAccounts(req)[Number(switcherPhoto)];
      const picture=entry&&profile(entry.owner)?.picture;
      requireCondition(picture,404,'Profile photo unavailable.');
      return Buffer.from(picture,'base64');
    }
    if (req.method === 'GET' && pathname === '/account/me') {
      if (!active) {
        const preserved=session(req,true);
        return preserved&&restriction.get(preserved.owner)?.status==='locked'?{account:null,locked:true}:{account:null};
      }
      const saved = profile(active.owner);
      const { picture, ...details } = saved ?? {};
      return { account: {
        id:active.owner,
        name: account.get(active.owner).name,
        profile: saved ? { ...details, hasPicture:!!picture } : null,
        pendingUsername: saved ? undefined : reservedUsername.get(active.owner,now())?.username,
        passkeys: keys.all(active.owner).map(({ id, label, created }) => ({ id, label, created })),
        emails: [...emails.all(active.owner),...inbound.addresses(active.owner)],
        canSendMail: !!outboundMail,
        canReceiveMail,
        externalMail,
        externalMailSubmission:!!outboundMail?.external,
        mailbox:saved ? saved.username+'@mail.xcenter.it' : null,
        ...badges(active.owner),
        externalMailLimits:outboundMail?.limits?.view(active.owner)??null,
      } };
    }

    if(req.method==='GET'&&pathname==='/account/mail/clients'){
      requireCondition(active,401,'Sign in first.');
      const identity=profile(active.owner);
      return {clients:mailCredentials.list(active.owner),profile:identity?{
        name:[identity.givenName,identity.surname].join(' '),username:identity.username,hasPicture:!!identity.picture,
      }:null};
    }
    if(req.method==='GET'&&pathname==='/account/email/incoming'){
      requireCondition(active,401,'Sign in first.');
      return {enabled:inbound.enabled,canSendLink:!!sendVerification,pending:inbound.pending(active.owner),
        outgoing:verification.pending(active.owner),result:inbound.result(active.owner),
        emails:[...emails.all(active.owner),...inbound.addresses(active.owner)]};
    }
    if(req.method==='GET'&&pathname==='/account/profile/visibility'){
      requireCondition(active,401,'Sign in first.');
      return {fields:JSON.parse(q('SELECT public_fields FROM account_flags WHERE owner=?').get(active.owner)?.public_fields??'[]')};
    }
    if (req.method === 'GET' && pathname === '/account/connected-apps') {
      requireCondition(active,401,'Sign in first.');
      return {apps:q('SELECT client,label,updated FROM connected_apps WHERE owner=? ORDER BY updated DESC LIMIT 100').all(active.owner).map(linkedAppBrand)};
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
      return {accounts:q(`SELECT p.username,p.owner,coalesce(e.premium_mail,0) AS premium FROM identity_profiles p
        LEFT JOIN account_entitlements e ON e.owner=p.owner ORDER BY p.username LIMIT 500`).all()
        .map(row=>({username:row.username,premium:!!row.premium,capacity:storageCapacity(row.owner),
          locked:restriction.get(row.owner)?.status==='locked',protected:isAdmin({owner:row.owner}),...badges(row.owner),hasPicture:!!profile(row.owner)?.picture}))};
    }
    if(req.method==='GET'&&pathname==='/account/username-change'){
      requireCondition(active,401,'Sign in first.');
      return {request:q('SELECT id,proposed,confirmed,expires FROM username_change_requests WHERE owner=? AND expires>?')
        .get(active.owner,now())??null};
    }
    if(req.method==='GET'&&pathname==='/account/admin/username-changes'){
      requireCondition(isAdmin(active),403,'Administrator access is required.');
      return {requests:q(`SELECT id,previous,proposed,expires FROM username_change_requests
        WHERE confirmed=1 AND expires>? AND owner NOT IN (SELECT owner FROM account_restrictions)
        ORDER BY expires LIMIT 100`).all(now())};
    }
    const adminPhoto=/^\/account\/admin\/accounts\/([a-z0-9._-]{3,24})\/avatar$/.exec(pathname)?.[1];
    if(req.method==='GET'&&adminPhoto){
      requireCondition(isAdmin(active),403,'Administrator access is required.');
      const selected=usernameOwner.get(adminPhoto);
      const picture=selected&&profile(selected.owner)?.picture;
      requireCondition(picture,404,'Profile photo unavailable.');
      return Buffer.from(picture,'base64');
    }
    if (req.method === 'GET' && pathname === '/account/avatar') {
      const picture = active && profile(active.owner)?.picture;
      requireCondition(picture,404,'Profile photo unavailable.');
      return Buffer.from(picture,'base64');
    }
    requireCondition(req.method === 'POST', 405, 'Method unavailable.');
    if (pathname === '/account/login/username' || pathname === '/account/login/code') {
      requireCondition(req.headers.origin===origin||nativeRequest(req),403,'Invalid origin.');
      limitChallenges();
      const input=await body(req);
      allowNewSignIn(req,active,input);
      if(active)requireCondition(session(req),401,'Sign in first.');
      const nativeChannel=nativeRequest(req);
      const channel=nativeChannel?'native':active?'web-add:'+active.hash:'web';
      if(pathname.endsWith('/username')){
        const username=typeof input.username==='string'?input.username.trim().toLowerCase():'';
        requireCondition(isUsername(username),422,'Enter a valid X-Center username.');
        const owner=usernameOwner.get(username)?.owner;
        requireCondition(owner&&(available(owner)||restriction.get(owner)?.status==='locked'),404,'No available X-Center ID uses this username.');
        if(!nativeChannel)checkBrowserCapacity(req,owner);
        if(restriction.get(owner)?.status==='locked')return {method:'passkey'};
        const email=emails.all(owner)[0]?.address;
        if(!email||!emailSignIn.enabled)return {method:'passkey'};
        const result=await emailSignIn.start(owner,email,channel);
        if(result.error)throw new AccountError(result.status,result.error);
        return result;
      }
      const owner=emailSignIn.finish(input.ticket,input.code,channel);
      requireCondition(owner,401,'The code is incorrect or expired.');
      const timestamp=now();
      const value=login(req,res,owner,nativeChannel?{created:timestamp,expires:timestamp+sessionAge}:undefined);
      return nativeChannel?{token:value}:{ok:true};
    }
    if (pathname === '/account/native/exchange') {
      requireCondition(nativeRequest(req),403,'Use the X-Center ID app.');
      limitChallenges();
      const input=await body(req);
      const source=native.exchange(input);
      const browser=source && lookupPreservedSession.get(source,now());
      requireCondition(browser,401,'The app sign-in expired. Start again.');
      return {token:login(req,res,browser.owner,browser,true)};
    }
    requireCondition(allowsMutation(req)||(pathname==='/account/logout'&&nativeRequest(req)&&session(req,true)),403,'Invalid origin.');
    if (pathname === '/account/mail/send') requireCondition(active,401,'Sign in first.');
    const input = await body(req,pathname==='/account/mail/send'?512*1024:undefined);
    if(active)requireCondition(session(req),401,'Sign in first.');
    if(pathname==='/account/switcher'){
      requireCondition(!nativeRequest(req)&&req.headers['x-authnjs-request']==='account-consent',403,'Switch accounts from the dashboard.');
      requireCondition(activateBrowserAccount(req,res,input.slot),404,'This sign-in is unavailable.');
      return {ok:true};
    }
    if(pathname==='/account/delete'){
      recent(active);
      requireCondition(req.headers['x-authnjs-request']==='account-consent',403,'Delete your account from Settings.');
      const person=profile(active.owner);
      requireCondition(person&&input.confirmation===person.username,422,'Enter your username to confirm deletion.');
      requireCondition(!adminIds.has(active.owner),409,'Transfer appliance administration before deleting this account.');
      db.exec('BEGIN IMMEDIATE');
      try{deleteIdentity(active.owner,person.username);db.exec('COMMIT');}
      catch(error){db.exec('ROLLBACK');throw error;}
      finishDeletion(active.owner);
      if(!nativeRequest(req))setBrowserAccounts(res,'',browserAccounts(req));
      return {ok:true};
    }
    if(pathname==='/account/reauth/native'){
      requireCondition(active&&nativeRequest(req),401,'Use the signed-in account manager.');
      q('DELETE FROM native_confirmations WHERE expires<=? OR hash=?').run(now(),active.hash);
      const code=token();
      q('INSERT INTO native_confirmations VALUES(?,?,?)').run(digest(code),active.hash,now()+120_000);
      return {url:origin+'/reauth?request='+code,state:code};
    }
    if(pathname==='/account/admin/account-status'){
      requireCondition(isAdmin(active),403,'Administrator access is required.');
      recent(active);
      requireCondition(req.headers['x-authnjs-request']==='account-consent',403,'Invalid request.');
      const {username,action,confirmation}=input;
      const target=typeof username==='string'&&usernameOwner.get(username)?.owner;
      requireCondition(target&&!isAdmin({owner:target}),422,'Choose an account that is not an administrator.');
      requireCondition(['lock','unlock','delete','revoke-sessions'].includes(action),422,'Choose a valid account action.');
      requireCondition(action!=='delete'||confirmation===username,422,'Enter the username to confirm deletion.');
      db.exec('BEGIN IMMEDIATE');
      try {
        if(action==='unlock') q("DELETE FROM account_restrictions WHERE owner=? AND status='locked'").run(target);
        if(action==='lock'||action==='delete'){
          q(`INSERT INTO account_restrictions VALUES(?,?) ON CONFLICT(owner)
            DO UPDATE SET status=excluded.status`).run(target,action==='delete'?'deleted':'locked');
        }
        if(action==='delete'||action==='revoke-sessions'){
          q('DELETE FROM account_sessions WHERE owner=?').run(target);
          q('DELETE FROM email_signins WHERE owner=?').run(target);
        }
        if(action==='delete')deleteIdentity(target,username);
        q('INSERT INTO account_admin_events VALUES(?,?,?,?,?)').run(randomUUID(),active.owner,target,action,now());
        db.exec('COMMIT');
      } catch(error){db.exec('ROLLBACK');throw error;}
      if(action==='delete')finishDeletion(target);
      return {ok:true};
    }
    if(pathname==='/account/username-change'||pathname==='/account/admin/username-changes'){
      requireCondition(active,401,'Sign in first.');
      if(pathname.includes('/admin/')||input.action==='confirm')recent(active);
      requireCondition(req.headers['x-authnjs-request']==='account-consent',403,'Invalid request.');
      requireCondition(profileKey,503,'Username changes require encrypted account storage.');
      const admin=pathname.includes('/admin/');
      const {id,action}=input;
      if(admin)requireCondition(isAdmin(active),403,'Administrator access is required.');
      db.exec('BEGIN IMMEDIATE');
      try {
        const get=q('SELECT * FROM username_change_requests WHERE id=? AND expires>?');
        if(!admin&&action==='request'){
          const current=profile(active.owner);
          requireCondition(current,422,'Finish setting up your profile.');
          const candidate=validateUsername(input.username,reservedNames);
          requireCondition(!candidate.error&&candidate.username!==current.username,422,candidate.error??'Choose a different username.');
          ensureAvailable(candidate.username);
          q(`INSERT INTO username_change_requests VALUES (?,?,?,?,?,0) ON CONFLICT(owner) DO UPDATE SET
            id=excluded.id,previous=excluded.previous,proposed=excluded.proposed,expires=excluded.expires,confirmed=0`)
            .run(active.owner,randomUUID(),current.username,candidate.username,now()+86400_000);
        } else {
          const request=typeof id==='string'&&get.get(id,now());
          requireCondition(request&&(admin?request.confirmed&&available(request.owner):request.owner===active.owner),
            404,'This username request is unavailable.');
          if(!admin&&action==='confirm')q('UPDATE username_change_requests SET confirmed=1 WHERE id=?').run(id);
          else if ((!admin&&action==='cancel')||(admin&&['approve','reject'].includes(action))){
            if(action==='approve'){
              const current=profile(request.owner);
              requireCondition(current?.username===request.previous,409,'The current username changed. Create a new request.');
              const candidate=validateUsername(request.proposed,reservedNames);
              requireCondition(candidate.username,409,'This username is unavailable.');
              ensureAvailable(request.proposed);
              writeProfile(request.owner,{...current,username:request.proposed});
              q('INSERT INTO retired_usernames VALUES(?)').run(request.previous);
            }
            q('DELETE FROM username_change_requests WHERE id=?').run(id);
            if(admin)q('INSERT INTO account_admin_events VALUES(?,?,?,?,?)')
              .run(randomUUID(),active.owner,request.owner,action+'-username',now());
          } else throw new AccountError(422,'Choose a valid username request action.');
        }
        db.exec('COMMIT');
      } catch(error){db.exec('ROLLBACK');throw error;}
      return {ok:true};
    }
    if(pathname==='/account/native/authorize'){
      const source=active??session(req,true);
      requireCondition(source && req.headers.origin===origin,401,'Sign in to X-Center ID first.');
      limitChallenges();
      const location=native.issue(source.hash,input.challenge,input.state);
      requireCondition(location,422,'Invalid app sign-in request.');
      return {location};
    }
    if (pathname === '/account/logout') {
      const signedIn = active??session(req,true);
      if (signedIn) removeSession.run(signedIn.hash);
      if(!nativeRequest(req))setBrowserAccounts(res,'',browserAccounts(req));
      return { ok: true };
    }
    if (pathname === '/account/devices/revoke') {
      requireCondition(active,401,'Sign in first.');
      const changed=q(`DELETE FROM account_sessions WHERE owner=? AND hash<>? AND
        hash=(SELECT hash FROM account_devices WHERE id=?)`).run(active.owner,active.hash,input.id??'');
      requireCondition(changed.changes===1,404,'Session unavailable.');
      return {ok:true};
    }
    if(pathname==='/account/profile/visibility'){
      requireCondition(active&&allowsMutation(req),403,'Sign in first.');
      const fields=input.fields;
      requireCondition(Array.isArray(fields)&&fields.length<=4&&fields.every(f=>['username','givenName','surname','picture'].includes(f)),422,'Choose public profile fields.');
      q('INSERT OR IGNORE INTO account_flags(owner) VALUES(?)').run(active.owner);
      q('UPDATE account_flags SET public_fields=? WHERE owner=?').run(JSON.stringify([...new Set(fields)]),active.owner);
      return {ok:true};
    }
    if(pathname==='/account/admin/storage'){
      requireCondition(isAdmin(active),403,'Administrator access is required.');
      recent(active);
      const selected=usernameOwner.get(typeof input.username==='string'?input.username:'');
      requireCondition(selected&&Number.isSafeInteger(input.capacity)&&input.capacity>=1024**2&&input.capacity<=1024**4*100,422,'Enter an account and a capacity from 1 MB to 100 TB.');
      q(`INSERT INTO account_storage_caps VALUES(?,?) ON CONFLICT(owner) DO UPDATE SET bytes=excluded.bytes`).run(selected.owner,input.capacity);
      return {ok:true,capacity:input.capacity};
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
    if(pathname==='/account/mail/clients'){requireCondition(active,401,'Sign in first.');recent(active);
      if(input.action==='create')return mailCredentials.create(active.owner,input.label);
      requireCondition(input.action==='revoke'&&typeof input.id==='string',422,'Choose a mail client.');mailCredentials.revoke(active.owner,input.id);return {ok:true};}
    if(pathname==='/account/email/remove'){
      requireCondition(active,401,'Sign in first.');recent(active);
      requireCondition(typeof input.email==='string'&&input.email.length<=254,422,'Choose an email address.');
      const address=input.email.trim().toLowerCase();
      db.exec('BEGIN IMMEDIATE');
      try{
        q('DELETE FROM verified_emails WHERE owner=? AND address=?').run(active.owner,address);
        q('DELETE FROM account_email_addresses WHERE owner=? AND address=?').run(active.owner,address);
        q('DELETE FROM inbound_verifications WHERE owner=? AND address=?').run(active.owner,address);
        q('DELETE FROM email_verifications WHERE owner=? AND address=?').run(active.owner,address);
        q('DELETE FROM email_signins WHERE owner=?').run(active.owner);
        db.exec('COMMIT');return {ok:true};
      }catch(error){db.exec('ROLLBACK');throw error;}
    }
    if(pathname==='/account/email/add'){
      requireCondition(active,401,'Sign in first.');
      const result=inbound.add(active.owner,input.email);
      requireCondition(result.ok,result.status,result.error);
      return result;
    }
    if(pathname==='/account/email/incoming'){
      requireCondition(active,401,'Sign in first.');
      const result=inbound.start(active.owner,input.email);
      if(!result.ok)throw new AccountError(result.status,result.error);
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
      const chosen = existing?.username ?? reservedUsername.get(active.owner,now())?.username;
      const candidate = validateProfile({ ...input, username:chosen ?? input.username },reservedNames,existing?.username);
      requireCondition(!candidate.error,422,candidate.error);
      const replacement = input.picture == null ? undefined : await normalizePicture(input.picture);
      db.exec('BEGIN IMMEDIATE');
      try {
        requireCondition(session(req),401,'Sign in first.');
        const current=profile(active.owner);
        const picture=input.picture===undefined?current?.picture:replacement;
        candidate.username=current?.username??candidate.username;
        ensureAvailable(candidate.username,active.owner);
        const before=profileBytes.get(active.owner)?.bytes??0;
        writeProfile(active.owner,{...candidate,picture});
        if(replacement && profileBytes.get(active.owner).bytes>before){
          const used=Object.values(accountUsage(active.owner)).reduce((sum,value)=>sum+value,0);
          requireCondition(used+extraStorage(active.owner)<=storageCapacity(active.owner),409,'Account storage quota exceeded.');
        }
        q('DELETE FROM signup_usernames WHERE owner=?').run(active.owner);
        db.exec('COMMIT');
      } catch (error) { db.exec('ROLLBACK'); throw error; }
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
    requireCondition(['signup', 'login', 'add','reauth'].includes(action), 404, 'Account route unavailable.');
    if(action==='add')recent(active);
    else if(action!=='reauth')allowNewSignIn(req,active,input);
    if (pathname.endsWith('/options')) {
      if(action==='signup')checkBrowserCapacity(req,undefined);
      limitChallenges();
      if (action === 'login'||action==='reauth') {
        let nativeTarget;
        if(action==='reauth'){
          if(input.request!==undefined){
            nativeTarget=nativeConfirmation(input.request);
            requireCondition(nativeTarget,403,'This confirmation expired. Open it again from the X-Center ID app.');
          }else requireCondition(active,401,'Sign in first.');
        }
        const owner=nativeTarget?.owner??active?.owner;
        const options = await generateAuthenticationOptions({ rpID, userVerification: 'required',
          ...(action==='reauth'?{allowCredentials:keys.all(owner).map(({id,transports})=>({id,transports:JSON.parse(transports)}))}:{}) });
        const username = typeof input.username === 'string' ? input.username.trim().toLowerCase() : '';
        requireCondition(!username || isUsername(username),422,'Enter a valid X-Center username.');
        prepare(res, { action, username, expected:options.challenge, sessionHash:active?.hash,
          ...(nativeTarget?{target:nativeTarget.hash,request:input.request}:{}) });
        return options;
      }
      const name = passkeyLabel(input.name);
      requireCondition(input.name === undefined || name, 422, 'Enter a passkey name of up to 64 characters.');
      const owner = action==='signup'?randomUUID():active.owner;
      let signupUsername;
      if (action === 'signup') {
        const result = validateUsername(input.username,reservedNames);
        requireCondition(!result.error,422,result.error);
        signupUsername = result.username;
        ensureAvailable(signupUsername);
      }
      const options = await generateRegistrationOptions({
        rpName: 'X-Center ID', rpID, userID: new TextEncoder().encode(owner),
        userName: signupUsername ?? profile(owner)?.username ?? account.get(owner)?.name ?? 'X-Center ID',
        userDisplayName: signupUsername ?? account.get(owner)?.name ?? 'New X-Center ID',
        attestationType: 'none',
        excludeCredentials: keys.all(owner).map(({ id, transports }) => ({ id, transports: JSON.parse(transports) })),
        authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
      });
      prepare(res, { action, owner, name, signupUsername, expected: options.challenge, sessionHash: active?.hash });
      return options;
    }
    requireCondition(pathname.endsWith('/finish'), 404, 'Account route unavailable.');
    const challenge = consume(req, action, active);
    requireCondition(input.response && typeof input.response.id === 'string', 400, 'Invalid passkey response.');
    if (action === 'login'||action==='reauth') {
      const saved = key.get(input.response.id);
      requireCondition(saved&&(available(saved.owner)||action==='login'&&restriction.get(saved.owner)?.status==='locked'), 401, 'Could not sign in with this passkey.');
      if(action==='reauth'){
        const target=challenge.target?nativeConfirmation(challenge.request):session(req);
        requireCondition(target&&(!challenge.target||target.hash===challenge.target),403,'This confirmation expired. Start again.');
        requireCondition(saved.owner===target.owner,403,'Use a passkey for the account requesting confirmation.');
      }
      const handle = input.response.response?.userHandle;
      requireCondition(!handle || handle === Buffer.from(saved.owner).toString('base64url'), 401, 'Could not sign in with this passkey.');
      const result = await verifyAuthenticationResponse({
        response: input.response, expectedChallenge: challenge.expected, expectedOrigin: origin, expectedRPID: rpID,
        requireUserVerification: true, credential: { id: saved.id, publicKey: saved.publicKey,
          counter: saved.counter, transports: JSON.parse(saved.transports) },
      }).catch(() => null);
      requireCondition(result?.verified && (!challenge.username || profile(saved.owner)?.username === challenge.username),
        401, 'Could not sign in with this passkey and username.');
      requireCondition(available(saved.owner)||action==='login'&&restriction.get(saved.owner)?.status==='locked',401,'Sign-in is unavailable.');
      requireCondition(q('UPDATE passkeys SET counter=? WHERE id=? AND counter=?')
        .run(result.authenticationInfo.newCounter, saved.id, saved.counter).changes === 1, 409, 'Sign-in changed. Try again.');
      if(action==='reauth'){
        const target=challenge.target?nativeConfirmation(challenge.request):session(req);
        requireCondition(target?.owner===saved.owner&&target.hash===(challenge.target??active?.hash),403,'This confirmation expired. Start again.');
        const elevate=q('INSERT INTO session_confirmations VALUES(?,?) ON CONFLICT(hash) DO UPDATE SET expires=excluded.expires');
        db.exec('BEGIN IMMEDIATE');
        try {
          if(challenge.target){
            requireCondition(q('DELETE FROM native_confirmations WHERE code=? AND hash=? AND expires>?')
              .run(digest(challenge.request),challenge.target,now()).changes===1,403,'Confirmation expired.');
          }
          elevate.run(target.hash,now()+30*60_000);
          db.exec('COMMIT');
        }catch(error){db.exec('ROLLBACK');throw error;}
        return {ok:true,...(challenge.target?{returnTo:'authnjs-dashboard://reauth?state='+challenge.request}:{})};
      }
      login(req,res,saved.owner,undefined,true);
      return { ok: true };
    }
    const result = await verifyRegistrationResponse({
      response: input.response, expectedChallenge: challenge.expected, expectedOrigin: origin,
      expectedRPID: rpID, requireUserVerification: true,
    }).catch(() => null);
    requireCondition(result?.verified && result.registrationInfo, 400, 'Could not register this passkey.');
    const { aaguid, credential } = result.registrationInfo;
    const label = challenge.name ?? await suggestLabel({ aaguid, transports: credential.transports });
    if(action==='signup'){
      if(active)requireCondition(session(req),401,'Sign in first.');
      checkBrowserCapacity(req,challenge.owner);
    }
    db.exec('BEGIN IMMEDIATE');
    try {
      if(action==='add')requireCondition(session(req),401,'Sign in first.');
      if (action === 'signup') {
        ensureAvailable(challenge.signupUsername);
        q('DELETE FROM signup_usernames WHERE expires<=?').run(now());
        q('INSERT INTO accounts VALUES (?,?,?)').run(challenge.owner,'X-Center ID',now());
        q('INSERT INTO signup_usernames VALUES (?,?,?)').run(challenge.owner,challenge.signupUsername,now()+86400_000);
      }
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
    handle,browserAccountOptions,activateBrowserAccount,
    retryDeletions:()=>{for(const {owner} of q('SELECT owner FROM account_deletion_jobs LIMIT 20').all())finishDeletion(owner);},
    current: (req) => session(req),
    supportCurrent: req=>session(req,true),
    allowsSupportMutation: req=>req.headers.origin===origin||(nativeRequest(req)&&!!session(req,true)),
    adminDetails(username) {
      const owner=usernameOwner.get(username)?.owner;
      if(!owner)return null;
      const person=profile(owner);
      return {owner,username,hasPicture:!!person?.picture,name:person?.givenName+' '+person?.surname,
        locked:restriction.get(owner)?.status==='locked',protected:isAdmin({owner}),...badges(owner),rootAdmin:adminIds.has(owner),capacity:storageCapacity(owner),
        externalMailLimits:outboundMail?.limits?.view(owner)??null,
        premium:q('SELECT premium_mail FROM account_entitlements WHERE owner=?').get(owner)?.premium_mail===1,
        created:q('SELECT created FROM accounts WHERE id=?').get(owner).created,
        devices:q('SELECT count(*) AS count FROM account_sessions WHERE owner=? AND expires>?').get(owner,now()).count,
        passkeys:keys.all(owner).length,
        apps:q('SELECT client,label,updated FROM connected_apps WHERE owner=? ORDER BY updated DESC').all(owner).map(linkedAppBrand)};
    },
    createMailboxAlias(owner,candidate,client=null){
      requireCondition(available(owner)&&profile(owner),403,'Account unavailable.');
      requireCondition(q('SELECT premium_mail FROM account_entitlements WHERE owner=?').get(owner)?.premium_mail===1,403,'Premium private addresses are not enabled for your account.');
      if(client){const existing=q('SELECT local,active FROM mailbox_aliases WHERE owner=? AND client=?').get(owner,client);if(existing)return existing.active?existing.local+'@mail.xcenter.it':null;}
      const words=['amber','birch','cedar','dawn','fern','grove','lark','maple','moss','pearl','reed','sage'];
      const chosen=candidate||words[randomBytes(1)[0]%words.length]+randomBytes(5).toString('hex');
      const result=validateUsername(chosen,reservedNames);requireCondition(!result.error,422,result.error);
      db.exec('BEGIN IMMEDIATE');
      try{
        requireCondition(q('SELECT count(*) AS n FROM mailbox_aliases WHERE owner=?').get(owner).n<30,409,'Private address limit reached.');
        requireCondition(!mailboxNameTaken(result.username)&&!usernameOwner.get(result.username)&&!reservedOwner.get(result.username,now())&&!q('SELECT 1 FROM retired_usernames WHERE username=?').get(result.username)&&!q('SELECT 1 FROM mailbox_aliases WHERE local=?').get(result.username),409,'This address is unavailable.');
        q('INSERT INTO mailbox_aliases VALUES(?,?,?,1,?)').run(result.username,owner,client,now());
        db.exec('COMMIT');return result.username+'@mail.xcenter.it';
      }catch(error){db.exec('ROLLBACK');throw error;}
    },
    setMailboxAlias(owner,local,enabled){
      requireCondition(typeof enabled==='boolean'&&available(owner),422,'Choose an address state.');
      if(enabled)requireCondition(q('SELECT premium_mail FROM account_entitlements WHERE owner=?').get(owner)?.premium_mail===1,403,'Premium private addresses are unavailable.');
      return q('UPDATE mailbox_aliases SET active=? WHERE owner=? AND local=?').run(Number(enabled),owner,local).changes===1;
    },
    linkedAppLabel:(owner,client)=>appBrand(client)?.name??q('SELECT label FROM connected_apps WHERE owner=? AND client=?').get(owner,client)?.label,
    isAdministrator:req=>isAdmin(session(req)),
    deleteMailboxAlias(owner,local){
      db.exec('BEGIN IMMEDIATE');
      try{
        const removed=q('DELETE FROM mailbox_aliases WHERE owner=? AND local=?').run(owner,local).changes;
        if(removed)q('INSERT OR IGNORE INTO retired_usernames VALUES(?)').run(local);
        db.exec('COMMIT');
        return !!removed;
      }catch(error){db.exec('ROLLBACK');throw error;}
    },
    mailboxSender(owner,address){
      const current=profile(owner)?.username+'@mail.xcenter.it';
      if(!available(owner))return false;
      if(address===current)return true;
      const local=/^([a-z0-9._-]{3,24})@mail\.xcenter\.it$/.exec(address)?.[1];
      return !!local&&!!q('SELECT 1 FROM mailbox_aliases WHERE owner=? AND local=? AND active=1').get(owner,local);
    },
    setMailLimits(owner,limits){
      requireCondition(outboundMail?.limits,503,'Mail limits unavailable.');
      outboundMail.limits.set(owner,limits);
    },
    setAccountFlag(req,owner,flag,value) {
      const active=session(req);
      requireCondition(isAdmin(active)&&confirmed(active)&&allowsMutation(req),403,'Confirm administrator access.');
      requireCondition(['verified','admin'].includes(flag)&&typeof value==='boolean'&&available(owner),422,'Choose an active account and setting.');
      requireCondition(flag!=='admin'||!adminIds.has(owner),403,'The operator administrator cannot be removed here.');
      requireCondition(flag!=='admin'||owner!==active.owner,403,'Ask another administrator to change your own administrator access.');
      q('INSERT OR IGNORE INTO account_flags(owner) VALUES(?)').run(owner);
      q('UPDATE account_flags SET '+flag+'=? WHERE owner=?').run(Number(value),owner);
    },
    recentlyConfirmed:req=>confirmed(session(req)),
    profileBadges:owner=>available(owner)?badges(owner):{verified:false,admin:false},
    badgeForAddress(address) {
      const user=q('SELECT owner FROM verified_emails WHERE address=?').get(address?.toLowerCase());
      const local=/^([a-z0-9._-]{3,24})@mail\.xcenter\.it$/.exec(address?.toLowerCase()??'');
      const owner=user?.owner??(local?(usernameOwner.get(local[1])?.owner??q('SELECT owner FROM mailbox_aliases WHERE local=? AND active=1').get(local[1])?.owner):null);
      if(!owner||!available(owner))return {verified:false,admin:false};
      return badges(owner);
    },
    publicProfile(username) {
      const owner=usernameOwner.get(username)?.owner;
      if(!owner||!available(owner))return null;
      const fields=JSON.parse(q('SELECT public_fields FROM account_flags WHERE owner=?').get(owner)?.public_fields??'[]');
      if(!fields.length)return null;
      const person=profile(owner), trust=badges(owner), result={username,...(trust.verified?{verified:true}:{}),...(trust.admin?{admin:true}:{})};
      for(const field of fields)if(['givenName','surname'].includes(field))result[field]=person[field];
      if(fields.includes('picture'))result.avatar=person.picture?'/public/profiles/'+username+'/avatar':null;
      return result;
    },
    publicProfileAvatar(username){const owner=usernameOwner.get(username)?.owner;if(!owner||!available(owner))return null;const fields=JSON.parse(q('SELECT public_fields FROM account_flags WHERE owner=?').get(owner)?.public_fields??'[]');return fields.includes('picture')?profile(owner)?.picture??null:null;},
    auditAdmin(req,target,action) {
      const active=session(req);
      requireCondition(isAdmin(active)&&confirmed(active),403,'Confirm administrator access.');
      q('INSERT INTO account_admin_events VALUES(?,?,?,?,?)').run(randomUUID(),active.owner,target,action,now());
    },
    available,
    ownerForUsername:username=>usernameOwner.get(username)?.owner,
    username: (owner) => q('SELECT username FROM identity_profiles WHERE owner=?').get(owner)?.username,
    allowsMutation,
    storageCapacity,
    adminStatus(req,write=false){
      const active=session(req);
      if(!isAdmin(active))return 403;
      if(!confirmed(active)||write&&!allowsMutation(req))return 403;
      return 200;
    },
    renameStoredUsername(owner, from, to) {
      if (!profileKey || !isUsername(to) || from === to) {
        throw new Error('Invalid operator rename configuration');
      }
      db.exec('BEGIN IMMEDIATE');
      try {
        const current = profile(owner);
        if (current?.username !== from || mailboxNameTaken(to) || usernameOwner.get(to) || reservedOwner.get(to,now()) ||
          q('SELECT 1 FROM retired_usernames WHERE username=?').get(to)||q('SELECT 1 FROM mailbox_aliases WHERE local=?').get(to)) {
          db.exec('ROLLBACK');
          return false;
        }
        writeProfile(owner,{...current,username:to});
        if (profile(owner)?.username !== to) throw new Error('Could not verify the renamed profile');
        db.exec('COMMIT');
        return true;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    rememberApp(owner,client,label,grant) {
      db.exec('BEGIN IMMEDIATE');
      try {
        q(`INSERT INTO connected_apps VALUES(?,?,?,?) ON CONFLICT(owner,client)
          DO UPDATE SET label=excluded.label,updated=excluded.updated`).run(owner,client,label,Date.now());
        q('INSERT OR IGNORE INTO app_link_grants VALUES(?,?,?)').run(owner,client,grant);
        db.exec('COMMIT');
      } catch(error) { db.exec('ROLLBACK'); throw error; }
    },
    isDisconnected(owner,client) {
      return !!q(`SELECT 1 FROM app_disconnects d WHERE d.owner=? AND d.client=?
        AND NOT EXISTS (SELECT 1 FROM connected_apps a WHERE a.owner=d.owner AND a.client=d.client)`).get(owner,client);
    },
    grantAllowed(owner,client,grant) {
      if(!available(owner))return false;
      if(!q('SELECT 1 FROM app_disconnects WHERE owner=? AND client=?').get(owner,client))return true;
      return !!grant&&!!q('SELECT 1 FROM app_link_grants WHERE owner=? AND client=? AND grant_id=?').get(owner,client,grant);
    },
    linkedGrant(owner,client) {
      return q(`SELECT g.grant_id AS id FROM app_link_grants g JOIN connected_apps c ON c.owner=g.owner AND c.client=g.client
        WHERE g.owner=? AND g.client=? ORDER BY g.rowid DESC LIMIT 1`).get(owner,client)?.id;
    },
    disconnect(owner,client) {
      db.exec('BEGIN IMMEDIATE');
      try {
        const grants=q('SELECT grant_id AS id FROM app_link_grants WHERE owner=? AND client=?').all(owner,client);
        const removed=q('DELETE FROM connected_apps WHERE owner=? AND client=?').run(owner,client);
        if(removed.changes===1){
          q('INSERT OR IGNORE INTO app_disconnects VALUES(?,?)').run(owner,client);
          q('DELETE FROM app_link_grants WHERE owner=? AND client=?').run(owner,client);
        }
        db.exec('COMMIT');
        return removed.changes===1?grants:null;
      } catch(error) { db.exec('ROLLBACK'); throw error; }
    },
    usage:accountUsage,
    premiumEligible: (owner) => q('SELECT premium_mail FROM account_entitlements WHERE owner=?').get(owner)?.premium_mail===1,
    profileAvatar:owner=>available(owner)?profile(owner)?.picture??null:null,
    identity(owner) {
      if(!available(owner))return undefined;
      const found = profile(owner);
      return found ? { username:found.username, givenName:found.givenName,surname:found.surname,
        ageRange:found.ageRange, hasPicture:!!found.picture, emails:emails.all(owner),...badges(owner) } : null;
    },
  };
}
