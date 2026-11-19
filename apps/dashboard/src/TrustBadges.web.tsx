import { BadgeCheck, Code2, ShieldCheck } from 'lucide-react';

export default function TrustBadges({verified,admin,kind='profile',compact=false}:{
  verified?:boolean|null; admin?:boolean; kind?:'profile'|'app'|'developer'; compact?:boolean;
}) {
  if(!verified&&!admin)return null;
  const VerificationIcon=kind==='developer'?Code2:BadgeCheck;
  const badge=(label:string,Icon:typeof BadgeCheck,adminBadge=false)=><span
    className={'xc-trust-badge'+(adminBadge?' xc-trust-admin':'')}
    role={compact?'img':undefined} aria-label={compact?label:undefined} title={compact?label:undefined}>
    <Icon size={15} aria-hidden="true"/>{!compact&&label}
  </span>;
  return <span className={'xc-trust-badges'+(compact?' xc-trust-compact':'')}>
    {verified&&badge('Verified '+kind,VerificationIcon)}
    {admin&&badge('Administrator',ShieldCheck,true)}
  </span>;
}
