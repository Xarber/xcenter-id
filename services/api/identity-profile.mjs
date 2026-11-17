const reserved = new Set([
  'abuse', 'admin', 'administrator', 'api', 'billing', 'contact', 'daemon', 'help',
  'hostmaster', 'info', 'mailer-daemon', 'management', 'mail', 'noc', 'noreply', 'no-reply',
  'postmaster', 'privacy', 'root', 'security', 'support', 'webmaster', 'xarber', 'xcenter',
  'schoolmanager', 'scuola', 'scuola2u', 'scuola2g', 'authnjs', 'authnjso', 'authphp', 'xauth',
  'aichat', 'app', 'aurea', 'assets', 'botanitags', 'chat', 'class', 'datapro', 'echo', 'exobot',
  'db', 'fetch', 'fieldplay', 'harmony', 'hme', 'homeassistant', 'homebridge', 'homenet', 'id', 'logs',
  'music', 'old', 'openrecode', 'pages', 'pathway', 'persona', 'persona-sites', 'projects', 'proxy', 'res',
  'respring', 's1tinfoil', 's2tinfoil', 's3tinfoil', 'sleepwell', 'ss', 'tempo',
  'tinfoil', 'unmasked', 'url', 'velunivo', 'wave', 'whasync',
]);
const namePattern = /^(?!.*[\p{Cc}\p{Cf}]).{1,64}$/u;
export function ageRangeFromBirthday(birthday, today = new Date()) {
  if (typeof birthday !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(birthday)) return null;
  const date = new Date(birthday + 'T00:00:00Z');
  if (!Number.isFinite(date.valueOf()) || date.toISOString().slice(0,10) !== birthday || date > today) return null;
  const year = today.getUTCFullYear() - date.getUTCFullYear();
  const beforeBirthday = today.toISOString().slice(5,10) < birthday.slice(5,10);
  const age = year - Number(beforeBirthday);
  if (age > 130) return null;
  return age < 13 ? 'child' : age < 18 ? 'teen' : 'adult';
}

export function validateProfile(input, additionallyReserved = [], currentUsername) {
  const givenName = typeof input.givenName === 'string' ? input.givenName.trim().normalize('NFC') : '';
  const surname = typeof input.surname === 'string' ? input.surname.trim().normalize('NFC') : '';
  const username = typeof input.username === 'string' ? input.username.trim().toLowerCase() : '';
  if (!namePattern.test(givenName) || !namePattern.test(surname)) return { error: 'Enter your given name and surname.' };
  const birthday = input.birthday;
  const ageRange = ageRangeFromBirthday(birthday);
  if (!ageRange) return { error: 'Enter a valid birthday.' };
  if (!/^[a-z][a-z0-9]{2,23}$/.test(username)) return { error: 'Use 3–24 letters and numbers, starting with a letter.' };
  if (username !== currentUsername && (reserved.has(username) || additionallyReserved.includes(username))) return { error: 'This username is unavailable.' };
  return { givenName, surname, username, birthday, ageRange };
}
