import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState, type ComponentProps } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View, useColorScheme, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import Landing from './Landing';
import { sample, type AccountItem } from './sample';

const sections = [
  { id: 'credentials', name: 'Security', icon: 'key-outline', description: 'Passkeys and physical security keys' },
  { id: 'apps', name: 'Connected apps', icon: 'apps-outline', description: 'Apps linked to your account' },
  { id: 'grants', name: 'Data access', icon: 'swap-horizontal-outline', description: 'What each app can access' },
  { id: 'sessions', name: 'Sessions', icon: 'phone-portrait-outline', description: 'Devices signed in to your account' },
] as const;

type Section = (typeof sections)[number];
type Icon = ComponentProps<typeof Ionicons>['name'];

const light = { background: '#f3f5f8', panel: '#ffffff', ink: '#142438', muted: '#4b5a6c', border: '#d6dee9', accent: '#174eaa', soft: '#e4edff' };
const dark = { background: '#101722', panel: '#192433', ink: '#f4f7ff', muted: '#b1c0d2', border: '#344359', accent: '#a8c7ff', soft: '#203a61' };
const isWeb = Platform.OS === 'web';
const webPreference = 'authnjs.dashboard.web-entry.v1';
const preference = 'authnjs.dashboard.onboarding.v1';
const entrance = FadeIn.duration(180).reduceMotion(ReduceMotion.System);

function Dashboard() {
  const colors = useColorScheme() === 'dark' ? dark : light;
  const wide = useWindowDimensions().width >= 740;
  const [landing, setLanding] = useState<boolean | null>(isWeb ? null : false);
  const [intro, setIntro] = useState<boolean | null>(null);
  const [demo, setDemo] = useState(false);
  const [section, setSection] = useState<Section | null>(null);
  const [removed, setRemoved] = useState<string[]>([]);
  const [pending, setPending] = useState<AccountItem | null>(null);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let active = true;
    if (isWeb) {
      AsyncStorage.getItem(webPreference).then(
        (value) => { if (active) setLanding(value !== 'entered'); },
        () => { if (active) setLanding(true); },
      );
    }
    AsyncStorage.getItem(preference).then(
      (value) => { if (active) setIntro(value !== 'complete'); },
      () => { if (active) setIntro(true); },
    );
    return () => { active = false; };
  }, []);

  function openWebApp() {
    setLanding(false);
    void AsyncStorage.setItem(webPreference, 'entered').catch(() => {});
  }

  function exitIntro() {
    setIntro(false);
    void AsyncStorage.setItem(preference, 'complete').catch(() => {
      setNotice('This device could not save your introduction preference.');
    });
  }

  function endDemo() {
    setDemo(false);
    setSection(null);
    setRemoved([]);
    setPending(null);
    setNotice('');
  }

  function button(label: string, icon: Icon, onPress: () => void) {
    return (
      <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [
        styles.button, { backgroundColor: colors.soft, opacity: pressed ? 0.72 : 1 },
      ]}>
        <Ionicons name={icon} color={colors.accent} size={19} />
        <Text style={[styles.action, { color: colors.accent }]}>{label}</Text>
      </Pressable>
    );
  }

  function row(title: string, detail: string, icon: Icon, onPress?: () => void) {
    const content = <>
      <View style={[styles.icon, { backgroundColor: colors.soft }]}>
        <Ionicons name={icon} size={21} color={colors.accent} />
      </View>
      <View style={styles.copy}>
        <Text style={[styles.title, { color: colors.ink }]}>{title}</Text>
        <Text style={[styles.secondary, { color: colors.muted }]}>{detail}</Text>
      </View>
      {onPress && <Ionicons name="chevron-forward" size={18} color={colors.muted} />}
    </>;
    const surface = [styles.row, { backgroundColor: colors.panel, borderColor: colors.border }];
    return onPress
      ? <Pressable key={title} accessibilityRole="button" onPress={onPress}
          style={({ pressed }) => [...surface, { opacity: pressed ? 0.72 : 1 }]}>{content}</Pressable>
      : <View style={surface}>{content}</View>;
  }

  const items: AccountItem[] = section ? sample[section.id].filter((item) => !removed.includes(item.id)) : [];
  const heading = intro ? 'One account across your apps' : section?.name ?? 'Your account';

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.content}>
          <View style={styles.header}>
            {isWeb ? (
              <Pressable accessibilityRole="button" accessibilityLabel="AuthNJS home" onPress={() => setLanding(true)} style={styles.header}>
                <Ionicons name="shield-checkmark" color={colors.accent} size={30} />
                <Text style={[styles.brand, { color: colors.ink }]}>AuthNJS</Text>
              </Pressable>
            ) : <>
              <Ionicons name="shield-checkmark" color={colors.accent} size={30} />
              <Text style={[styles.brand, { color: colors.ink }]}>AuthNJS</Text>
            </>}
            {demo && landing === false && <Text style={[styles.badge, { color: colors.accent, backgroundColor: colors.soft }]}>Sample data</Text>}
          </View>
          {landing === true && <Landing open={openWebApp} />}
          {landing === false && intro !== null && <Animated.View key={intro ? 'intro' : section?.id ?? 'overview'} entering={entrance} style={styles.stack}>
            {section && button('Account overview', 'arrow-back', () => { setPending(null); setSection(null); })}
            <Text accessibilityRole="header" style={[styles.heading, { color: colors.ink }]}>{heading}</Text>
            {intro ? <>
              <Text style={[styles.secondary, { color: colors.muted }]}>Manage your sign-in keys, connected apps and the data you choose to share.</Text>
              <View style={styles.actions}>
                {button('Get started', 'arrow-forward', exitIntro)}
                {button('Skip introduction', 'close', exitIntro)}
              </View>
            </> : !demo ? <>
              {row('Account service unavailable', 'Explore the dashboard with sample data while sign-in is being developed.', 'cloud-offline-outline')}
              <View style={styles.actions}>
                {button('Explore sample dashboard', 'eye-outline', () => { setNotice(''); setDemo(true); })}
                {button('View introduction', 'information-circle-outline', () => setIntro(true))}
              </View>
            </> : section ? <>
              <Text style={[styles.secondary, { color: colors.muted }]}>{section.description}</Text>
              {items.length === 0 && <Text style={[styles.secondary, { color: colors.muted }]}>No entries are available.</Text>}
              {items.map((item) => {
                const action = section.id === 'grants' ? 'Revoke access'
                  : section.id === 'sessions' && item.id !== 'phone' ? 'Sign out device' : undefined;
                return <View key={item.id} style={styles.stack}>
                  {row(item.title, item.detail, section.icon)}
                  {action && (pending?.id === item.id
                    ? <View style={styles.stack}>
                        <Text style={[styles.secondary, { color: colors.muted }]}>Apply this change to the sample dashboard?</Text>
                        <View style={styles.actions}>
                          {button(action, 'checkmark', () => {
                            setRemoved((ids) => [...ids, item.id]);
                            setPending(null);
                            setNotice(section.id === 'grants' ? 'Sample access revoked.' : 'Sample device signed out.');
                          })}
                          {button('Cancel', 'close', () => setPending(null))}
                        </View>
                      </View>
                    : button(action, 'remove-circle-outline', () => { setNotice(''); setPending(item); }))}
                </View>;
              })}
            </> : <>
              <Text style={[styles.secondary, { color: colors.muted }]}>Manage security and sharing from one place.</Text>
              <View style={wide ? styles.grid : styles.stack}>
                {sections.map((item) => (
                  <View key={item.id} style={wide && styles.column}>
                    {row(item.name, item.description, item.icon, () => { setNotice(''); setSection(item); })}
                  </View>
                ))}
              </View>
              {button('Exit sample dashboard', 'exit-outline', endDemo)}
            </>}
            {!!notice && <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={[styles.secondary, { color: colors.accent }]}>{notice}</Text>}
          </Animated.View>}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

export default function App() {
  return <SafeAreaProvider><Dashboard /></SafeAreaProvider>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { padding: 24, paddingBottom: 48 },
  content: { alignSelf: 'center', width: '100%', maxWidth: 960, gap: 32 },
  header: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10 },
  brand: { fontSize: 21, fontWeight: '800' },
  badge: { fontSize: 13, fontWeight: '700', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16 },
  stack: { gap: 12 },
  heading: { fontSize: 38, fontWeight: '800', letterSpacing: -1 },
  title: { fontSize: 17, fontWeight: '700' },
  secondary: { fontSize: 15, lineHeight: 23 },
  row: { minHeight: 78, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 18, padding: 14, gap: 12 },
  copy: { flex: 1, gap: 3 },
  icon: { minWidth: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  column: { flexBasis: '47%', flexGrow: 1 },
  actions: { gap: 10, flexDirection: 'row', flexWrap: 'wrap' },
  button: { alignSelf: 'flex-start', maxWidth: '100%', minHeight: 48, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, gap: 8, flexDirection: 'row', alignItems: 'center' },
  action: { flexShrink: 1, fontSize: 15, fontWeight: '700' },
});
