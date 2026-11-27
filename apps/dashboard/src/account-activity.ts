export type ActivityEvent = {
  id:number;
  kind:'sign-in'|'linked'|'permissions'|'unlinked'|'app-sign-out';
  subject:string|null;
  created:number;
  detail:null|{added?:string[];removed?:string[];sharedData?:boolean};
};

export const activityTitle:Record<ActivityEvent['kind'],string>={
  'sign-in':'Signed in',
  linked:'App linked',
  permissions:'App permissions changed',
  unlinked:'App unlinked',
  'app-sign-out':'Signed out of connected apps',
};

const permissions:Record<string,string>={
  openid:'Account ID',profile:'Profile',email:'Email address',age_range:'Age range',
  friends:'Friends list',offline_access:'Stay signed in',app_data:'App storage',
  files_read:'Read files',files_write:'Read and write files',shared_files_read:'Read shared files',
  account_overview:'Account overview',account_manage:'Account settings',
};

export function activitySummary({detail}:ActivityEvent){
  if(!detail)return '';
  const names=(scopes:string[])=>scopes.map(scope=>permissions[scope]??scope).join(', ');
  const added=detail.added??[], removed=detail.removed??[];
  return [
    added.length?'Granted '+names(added):'',
    removed.length?'Removed '+names(removed):'',
    detail.sharedData?'Cross-app data access changed':'',
  ].filter(Boolean).join(' · ');
}
