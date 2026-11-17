import { accountLanguage, accountMessage } from './account-locale';

const shortcuts = [
  ['profile','profileShortcut','profileDescription'],
  ['security','security','securityDescription'],
  ['permissions','permissions','permissionsDescription'],
  ['devices','devices','devicesDescription'],
] as const;

export function accountShortcuts(locale?:string) {
  return shortcuts.map(([id,label,description])=>({
    id,label:accountMessage(label,'',locale),description:accountMessage(description,'',locale),
  }));
}

export function accountGreeting(name:string,locale?:string) {
  return accountMessage('greeting','Hello, {name}',locale).replace('{name}',()=>name);
}

export function accountStatus(passkeys:number,emails:number,locale=Intl.DateTimeFormat().resolvedOptions().locale) {
  const numbers=new Intl.NumberFormat(locale);
  const plurals=new Intl.PluralRules(accountLanguage(locale));
  const count=(key:string,value:number)=>accountMessage(key+(plurals.select(value)==='one'?'One':'Other'),'',locale)
    .replace('{count}',numbers.format(value));
  return count('enrolled',passkeys)+' · '+count('verified',emails);
}
