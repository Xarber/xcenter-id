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
const ageRanges = new Set(['child', 'teen', 'adult']);

export function validateProfile(input, additionallyReserved = []) {
  const givenName = typeof input.givenName === 'string' ? input.givenName.trim().normalize('NFC') : '';
  const surname = typeof input.surname === 'string' ? input.surname.trim().normalize('NFC') : '';
  const username = typeof input.username === 'string' ? input.username.trim().toLowerCase() : '';
  if (!namePattern.test(givenName) || !namePattern.test(surname) || !ageRanges.has(input.ageRange)) {
    return { error: 'Enter a given name, surname and age range.' };
  }
  if (!/^[a-z][a-z0-9]{2,23}$/.test(username)) return { error: 'Use 3–24 letters and numbers, starting with a letter.' };
  if (reserved.has(username) || additionallyReserved.includes(username)) return { error: 'This username is unavailable.' };
  return { givenName, surname, username, ageRange: input.ageRange };
}
