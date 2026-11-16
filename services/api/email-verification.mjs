import { randomBytes, createHash } from 'node:crypto';
import nodemailer from 'nodemailer';

const digest = (value) => createHash('sha256').update(value).digest('hex');
const addressPattern = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/i;

export function createVerificationMailer(config) {
  if (!config) return null;
  const from = config.from?.toLowerCase();
  if (!/^[a-z0-9-]+@(?:management\.|mail\.)?xcenter\.it$/.test(from ?? '') ||
      ['support@xcenter.it','xarber@xcenter.it','schoolmanager@xcenter.it'].includes(from) ||
      !config.host || !config.user || !config.password) {
    throw new Error('Invalid X-Center verification sender configuration');
  }
  const transport = nodemailer.createTransport({
    host: config.host, port: config.port ?? 465, secure: (config.port ?? 465) === 465,
    requireTLS: true, auth: { user: config.user, pass: config.password },
    connectionTimeout: 8000, greetingTimeout: 8000, socketTimeout: 12000,
    disableFileAccess: true, disableUrlAccess: true,
  });
  return ({ address, link }) => transport.sendMail({
    from: { name: 'X-Center ID', address: from }, to: address,
    subject: 'Verify your email for X-Center ID',
    text: 'Verify ownership of this address by opening the link and signing in to your X-Center ID account. The link expires in 20 minutes.\n\n' + link,
  });
}

export function openEmailVerification(db, { send, origin }) {
  db.exec(`CREATE TABLE IF NOT EXISTS email_verifications (
    owner TEXT PRIMARY KEY, address TEXT NOT NULL, digest TEXT UNIQUE NOT NULL, created INTEGER NOT NULL,
    expires INTEGER NOT NULL
  ) STRICT`);
  const pending = db.prepare('SELECT * FROM email_verifications WHERE owner=?');
  const insert = db.prepare(`INSERT INTO email_verifications VALUES (?,?,?,?,?) ON CONFLICT(owner)
    DO UPDATE SET address=excluded.address,digest=excluded.digest,created=excluded.created,expires=excluded.expires`);
  const remove = db.prepare('DELETE FROM email_verifications WHERE owner=? AND digest=?');
  const save = db.prepare('INSERT INTO verified_emails VALUES (?,?,?) ON CONFLICT(address) DO NOTHING');
  const verified = db.prepare('SELECT owner FROM verified_emails WHERE address=?');
  const recentRecipient = db.prepare('SELECT 1 FROM email_verifications WHERE address=? AND created>?');
  const sent = db.prepare('SELECT count(*) AS total FROM email_verifications WHERE created>?');

  return {
    async start(owner, candidate) {
      if (!send) return { status:503, error:'Email verification is unavailable. No address was saved.' };
      const address = typeof candidate === 'string' ? candidate.trim().toLowerCase() : '';
      if (!addressPattern.test(address) || address.length > 254 || address.includes('..')) {
        return { status:422, error:'Enter a valid email address.' };
      }
      const timestamp = Date.now();
      if (timestamp - (pending.get(owner)?.created ?? 0) < 60_000 ||
          recentRecipient.get(address,timestamp-60_000) || sent.get(timestamp-60_000).total >= 30) {
        return { status:429, error:'Please wait before requesting another message.' };
      }
      const token = randomBytes(32).toString('base64url');
      const hash = digest(token);
      insert.run(owner,address,hash,timestamp,timestamp+1200_000);
      try { await send({ address, link:origin+'/#verify-email='+token }); }
      catch { return { status:503,error:'Could not send the verification message. Try again later.' }; }
      return { ok:true };
    },
    confirm(owner, value) {
      if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(value)) return false;
      const record = pending.get(owner);
      const hash = digest(value);
      if (record?.digest !== hash || record.expires <= Date.now()) return false;
      db.exec('BEGIN IMMEDIATE');
      try {
        if (remove.run(owner,hash).changes !== 1) { db.exec('ROLLBACK'); return false; }
        save.run(owner,record.address,Date.now());
        const accepted = verified.get(record.address)?.owner === owner;
        db.exec('COMMIT');
        return accepted;
      } catch (error) { db.exec('ROLLBACK'); throw error; }
    },
  };
}
