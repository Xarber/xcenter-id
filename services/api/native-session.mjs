import { createHash, randomBytes } from 'node:crypto';

const base64url = /^[A-Za-z0-9_-]{43}$/;
const redirect = 'authnjs-dashboard://session';
const sha256 = (value) => createHash('sha256').update(value).digest('base64url');

export function openNativeSession(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS native_sessions(hash TEXT PRIMARY KEY REFERENCES account_sessions(hash) ON DELETE CASCADE) STRICT;
    CREATE TABLE IF NOT EXISTS native_codes(
      hash TEXT PRIMARY KEY,challenge TEXT NOT NULL,state TEXT NOT NULL,
      session TEXT NOT NULL REFERENCES account_sessions(hash) ON DELETE CASCADE,expires INTEGER NOT NULL
    ) STRICT;`);
  const codes = db.prepare('DELETE FROM native_codes WHERE hash=? AND challenge=? AND state=? AND expires>? RETURNING session');
  const store = db.prepare('INSERT INTO native_codes VALUES (?,?,?,?,?)');
  const clear = db.prepare('DELETE FROM native_codes WHERE expires<=?');
  const bound = db.prepare('SELECT 1 FROM native_sessions WHERE hash=?');
  const register = db.prepare('INSERT INTO native_sessions VALUES (?)');
  return {
    issue(session, challenge, state) {
      if (!base64url.test(challenge ?? '') || !base64url.test(state ?? '')) return null;
      const now = Date.now();
      clear.run(now);
      const code = randomBytes(32).toString('base64url');
      store.run(sha256(code),challenge,state,session,now+60_000);
      return redirect+'?'+new URLSearchParams({code,state});
    },
    exchange({code,verifier,state}) {
      if (![code,verifier,state].every(value=>typeof value === 'string' && base64url.test(value))) return null;
      return codes.get(sha256(code),sha256(verifier),state,Date.now())?.session ?? null;
    },
    accepts: (hash) => !!bound.get(hash),
    bind: (hash) => register.run(hash),
  };
}
