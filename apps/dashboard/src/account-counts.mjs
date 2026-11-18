/** Hermes may omit Intl.PluralRules. These are the supported catalog languages. */
export function accountCount(value,locale) {
  const language=locale.split('-')[0].toLowerCase();
  const one=language==='fr'||language==='pt'?value===0||value===1:value===1;
  let formatted=String(value);
  if(typeof Intl?.NumberFormat==='function') {
    try { formatted=new Intl.NumberFormat(locale).format(value); } catch { /* Use decimal digits. */ }
  }
  return {suffix:one?'One':'Other',formatted};
}
