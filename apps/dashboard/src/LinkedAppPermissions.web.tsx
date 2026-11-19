import { Check, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { linkedPermissionPath, permissionDescription, permissionLabels, type LinkedPermission } from './linked-permissions';
import { api } from './web-account';

export default function LinkedAppPermissions({client}: {client:string}) {
  const [items, setItems] = useState<LinkedPermission[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const path = linkedPermissionPath(client);

  useEffect(() => {
    let active = true;
    void api(path).then(({permissions}) => {
      if (active) setItems(permissions);
    }).catch(failure => { if (active) setError(failure.message); });
    return () => { active = false; };
  }, [path]);

  async function change(scope:LinkedPermission['scope'], enabled:boolean) {
    setBusy(true);
    setError('');
    try { setItems((await api(path, {scope, enabled}, 'PUT')).permissions); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not update permission.'); }
    finally { setBusy(false); }
  }

  return <section className="xc-card xc-pad">
    <div className="xc-row-head"><ShieldCheck size={20} aria-hidden="true"/><h2>Sign-in permissions</h2></div>
    {items?.map(item => <div key={item.scope} className="xc-list-row">
      <div><strong>{permissionLabels[item.scope]}</strong>{permissionDescription(item)&&<p>{permissionDescription(item)}</p>}</div>
      {item.required ? (item.enabled&&<Check size={19} role="img" aria-label="Allowed"/>) :
        <button type="button" role="switch" aria-checked={item.enabled} aria-label={permissionLabels[item.scope]}
          className="xc-permission-switch" disabled={busy||!item.enabled&&!item.canEnable}
          onClick={() => void change(item.scope, !item.enabled)}><span aria-hidden="true"/></button>}
    </div>)}
    {!items&&!error&&<p role="status">Loading sign-in permissions…</p>}
    {error&&<p role="alert">{error}</p>}
  </section>;
}
