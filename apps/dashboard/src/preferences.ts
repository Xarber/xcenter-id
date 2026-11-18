export type Preferences={language:string;theme:'system'|'light'|'dark'};
export const preferencesKey='xcenter.preferences.v1';
export const languages=[['system','System language'],['en','English'],['it','Italiano'],['fr','Français'],['de','Deutsch'],['es','Español'],['pt','Português']] as const;
export function parsePreferences(raw:string|null):Preferences {
  try{const input=JSON.parse(raw??'{}');return {language:languages.some(([id])=>id===input.language)?input.language:'system',theme:['light','dark'].includes(input.theme)?input.theme:'system'};}
  catch{return {language:'system',theme:'system'};}
}
