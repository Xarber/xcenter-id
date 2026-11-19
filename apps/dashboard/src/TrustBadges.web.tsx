import { BadgeCheck, ShieldCheck } from 'lucide-react';

export default function TrustBadges({verified,admin,kind='profile'}:{
  verified?:boolean|null; admin?:boolean; kind?:'profile'|'app';
}) {
  if(!verified&&!admin)return null;
  return <span className="xc-trust-badges">
    {verified&&<span className="xc-trust-badge"><BadgeCheck size={15} aria-hidden="true"/> Verified {kind}</span>}
    {admin&&<span className="xc-trust-badge xc-trust-admin"><ShieldCheck size={15} aria-hidden="true"/> Administrator</span>}
  </span>;
}
