import ListPages from './ListPages';
import {useListPage} from './list-page';
import AppIcon from './AppIcon';
import { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import ApplicationStorage from './ApplicationStorage';
import TrustBadges from './TrustBadges';
import { nativeRequest } from './native-account';
import { Surface, SurfaceTitle, type DashboardTheme } from './native-surfaces';
import { useDialog } from './dialog-model';
import { formatBytes } from './storage-summary';

type Developer = { owner: string; name: string; status: string; githubProfile?: string };
type Registration = { icon?:string|null; id: string; name: string; status: string; callback: string; developerName?: string; repository?: string; verified: boolean; administration?:boolean; local?:boolean };
type Volume = { id: string; label: string; status: 'available' | 'unavailable' | 'read-only' | 'full'; free?: number; total?: number; freeFiles?: number };
const volumeStatus = { available: 'Available', unavailable: 'Temporarily unavailable', 'read-only': 'Read-only', full: 'Full' };

export default function NativeAdminInventory({ token, colors, onDetail }: {
  token: string; colors: DashboardTheme; onDetail: (open: boolean) => void;
}) {
  const showDialog=useDialog();
  const [inventory, setInventory] = useState<{ apps: Registration[]; developers: Developer[] }>();
  const [volumes, setVolumes] = useState<Volume[]>();
  const [inventoryError, setInventoryError] = useState('');
  const [volumeError, setVolumeError] = useState('');
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);
  const [storage, setStorage] = useState('');
  const registered=inventory?.apps.filter(app=>app.status!=='revoked');
  const appPage=useListPage(registered?.length??0);
  const developerPage=useListPage(inventory?.developers.length??0);
  const api = (path: string, payload?: object) => nativeRequest(path, token, payload);

  async function refreshStorage() {
    setChecking(true);
    setVolumeError('');
    try { setVolumes((await api('admin/storage-volumes')).volumes); }
    catch { setVolumeError('Storage status unavailable.'); }
    finally { setChecking(false); }
  }

  useEffect(() => {
    let active = true;
    void api('admin/apps').then(data => {
      if (active) setInventory(data);
    }).catch(() => {
      if (active) setInventoryError('Could not load developer registrations.');
    });
    void refreshStorage();
    return () => { active = false; };
  }, [token]);

  async function verify(type: 'app' | 'developer' | 'administration', id: string, verified: boolean) {
    setBusy(true);
    setInventoryError('');
    try {
      await api('admin/apps', { type, id, verified });
      setInventory(await api('admin/apps'));
    } catch { setInventoryError('Could not update verification.'); }
    finally { setBusy(false); }
  }

  function action(label: string, onPress: () => void, disabled = busy) {
    return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress}
      style={({ pressed }) => [styles.action, { borderColor: colors.line, backgroundColor: pressed ? colors.soft : colors.panel, opacity: disabled ? 0.65 : 1 }]}>
      <Text style={{ color: colors.accent, fontWeight: '600' }}>{label}</Text>
    </Pressable>;
  }

  function review(label: string, url: string) {
    if (!url.startsWith('https://github.com/')) return null;
    return action(label, () => void Linking.openURL(url).catch(() => setInventoryError('Could not open GitHub.')), false);
  }

  if (storage) return <Surface colors={colors}><ApplicationStorage id={storage} token={token} colors={colors} admin
    back={() => { setStorage(''); onDetail(false); }} /></Surface>;
  const line = [styles.row, { borderColor: colors.line }];

  return <>
    <Surface colors={colors}>
      <SurfaceTitle colors={colors} title="Server storage" icon="server-outline" tint="mint" />
      <Text style={{ color: colors.muted }}>Capacity and health of storage connected to X-Center ID.</Text>
      {volumes?.map(volume => <View key={volume.id} style={line}>
        <Text style={{ color: colors.ink, fontWeight: '700' }}>{volume.label}</Text>
        <Text style={{ color: volume.status === 'available' ? colors.mintInk : colors.danger }}>{volumeStatus[volume.status]}</Text>
        {volume.free !== undefined && volume.total !== undefined && <Text style={{ color: colors.muted }}>
          {formatBytes(volume.free)} free · {formatBytes(volume.total)} total{volume.freeFiles === 0 ? ' · No free file entries' : ''}
        </Text>}
      </View>)}
      {!!volumeError && <Text accessibilityRole="alert" style={{ color: colors.danger }}>{volumeError}</Text>}
      {action(checking ? 'Checking storage…' : 'Refresh storage status', () => void refreshStorage(), checking)}
    </Surface>
    <Surface colors={colors}>
      <SurfaceTitle colors={colors} title="Developer verification" icon="shield-checkmark-outline" tint="lavender" />
      {inventory?.developers.length === 0 && <Text style={{ color: colors.muted }}>No developer reviews.</Text>}
      {inventory?.developers.slice(developerPage.start,developerPage.end).map(developer => {
        const verified = developer.status === 'verified';
        return <View key={developer.owner} style={line}>
          <Text style={{ color: colors.ink, fontWeight: '700' }}>{developer.name}</Text>
          <TrustBadges verified={verified} kind="developer" color={colors.accent} />
          {!verified && <Text style={{ color: colors.muted }}>{developer.status === 'requested' ? 'Review requested' : 'Unverified'}</Text>}
          <View style={styles.actions}>
            {developer.githubProfile && review('Review GitHub profile', developer.githubProfile)}
            {action(verified ? 'Remove verification' : 'Verify developer', () => void verify('developer', developer.owner, !verified))}
          </View>
        </View>;
      })}
      <ListPages state={developerPage} label="Developers" colors={colors}/>
    </Surface>
    <Surface colors={colors}>
      <SurfaceTitle colors={colors} title="Registered apps" icon="apps-outline" />
      {registered?.length === 0 && <Text style={{ color: colors.muted }}>No registered developer apps.</Text>}
      {registered?.slice(appPage.start,appPage.end).map(app => <View key={app.id} style={line}>
        <View style={{flexDirection:'row',alignItems:'center',gap:10}}>
          <AppIcon icon={app.icon} color={colors.accent}/>
          <Text style={{ color: colors.ink, fontWeight: '700',flex:1 }}>{app.name}</Text>
        </View>
        <Text style={{ color: colors.muted }}>{app.developerName ?? 'Developer'} · {app.status}</Text>
        <TrustBadges verified={app.verified} kind="app" color={colors.accent} />
        <View style={styles.actions}>
          {app.repository && review('Review repository', app.repository)}
          {app.status === 'active' && app.verified && action('Manage app storage', () => { setStorage(app.id); onDetail(true); })}
          {!app.local&&app.status==='active'&&(app.verified||app.administration)&&action(
            app.administration?'Remove Administration app trust':'Enable Administration app',()=>showDialog(
              app.administration?'Remove Administration app trust?':'Enable Administration app?',
              'Users must separately approve access to account overview or settings.',
              [{text:'Cancel',style:'cancel'},{text:'Confirm',onPress:()=>void verify('administration',app.id,!app.administration)}]))}
          {action(app.verified ? 'Remove verification' : 'Verify app', () => void verify('app', app.id, !app.verified))}
        </View>
      </View>)}
      <ListPages state={appPage} label="Registered apps" colors={colors}/>
    </Surface>
    {!!inventoryError && <Text accessibilityRole="alert" style={{ color: colors.danger }}>{inventoryError}</Text>}
  </>;
}

const styles = StyleSheet.create({
  row: { borderTopWidth: 1, paddingTop: 12, gap: 6 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  action: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', borderWidth: 1, borderRadius: 10, paddingHorizontal: 10 },
});
