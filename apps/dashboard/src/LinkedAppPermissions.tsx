import { useConfirmDialog } from './dialog-model';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Switch, Text, View } from 'react-native';
import { administrativePermission, riskyPermission, linkedPermissionPath, permissionDescription, permissionLabels, type LinkedPermission } from './linked-permissions';
import { nativeRequest } from './native-account';

export default function LinkedAppPermissions({client, token, colors}: {
  client:string; token:string; colors:{ink:string; accent:string; muted:string};
}) {
  const [items, setItems] = useState<LinkedPermission[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const confirm = useConfirmDialog();
  const path = linkedPermissionPath(client);

  useEffect(() => {
    let active = true;
    void nativeRequest(path, token).then(({permissions}) => {
      if (active) setItems(permissions);
    }).catch(failure => { if (active) setError(failure.message); });
    return () => { active = false; };
  }, [path, token]);

  async function change(scope:LinkedPermission['scope'], enabled:boolean) {
    const confirmed = enabled && riskyPermission(scope);
    const item = items?.find(permission => permission.scope === scope);
    if (confirmed && !await confirm(permissionLabels[scope] + '?', 'Allow access',
      item && permissionDescription(item))) return;
    setBusy(true);
    setError('');
    try { setItems((await nativeRequest(path, token, {scope, enabled, confirmed}, 'PUT')).permissions); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not update permission.'); }
    finally { setBusy(false); }
  }

  const rows = (permissions: LinkedPermission[]) => permissions.map(item => <View key={item.scope} style={{flexDirection:'row',alignItems:'center',gap:12}}>
      <View style={{flex:1,gap:3}}><Text style={{color:colors.ink}}>{permissionLabels[item.scope]}</Text>
        {!!permissionDescription(item)&&<Text style={{color:colors.muted}}>{permissionDescription(item)}</Text>}</View>
      {item.required ? (item.enabled&&<Ionicons name="checkmark" size={21} color={colors.accent} accessibilityLabel="Allowed"/>) :
        <Switch accessibilityLabel={permissionLabels[item.scope]} value={item.enabled}
          disabled={busy||!item.enabled&&!item.canEnable} onValueChange={enabled=>void change(item.scope,enabled)}/>}
    </View>);
  const administrative = items?.filter(administrativePermission) ?? [];
  return <View style={{gap:12}}>
    <Text accessibilityRole="header" style={{color:colors.ink,fontWeight:'700'}}>Sign-in permissions</Text>
    {rows(items?.filter(item => !administrativePermission(item)) ?? [])}
    {!!administrative.length && <View style={{gap:12}}>
      <Text accessibilityRole="header" style={{color:colors.ink,fontWeight:'700'}}>Administrative App Permissions</Text>
      {rows(administrative)}
    </View>}
    {!items&&!error&&<Text style={{color:colors.muted}}>Loading sign-in permissions…</Text>}
    {!!error&&<Text accessibilityRole="alert" style={{color:colors.ink}}>{error}</Text>}
  </View>;
}
