import { accountCount } from './account-counts.mjs';
import { accountMessage } from './account-locale';

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
  const count=(key:string,value:number)=>{
    const {suffix,formatted}=accountCount(value,locale);
    return accountMessage(key+suffix,'',locale).replace('{count}',formatted);
  };
  return count('enrolled',passkeys)+' · '+count('verified',emails);
}
