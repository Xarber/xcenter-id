import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useColorScheme, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';

const cards = [
  ['key-outline', 'Sign-in security', 'Manage passkeys, security keys and signed-in devices.'],
  ['apps-outline', 'Connected apps', 'See the apps linked to your account in one place.'],
  ['swap-horizontal-outline', 'Data access', 'Review what an app can read and revoke access when needed.'],
] as const;

type InstallEvent = Event & { prompt(): Promise<unknown> };

export default function Landing({ open }: { open: () => void }) {
  const dark = useColorScheme() === 'dark';
  const wide = useWindowDimensions().width >= 760;
  const [install, setInstall] = useState<InstallEvent | null>(null);
  const ink = dark ? '#f1f5ff' : '#132645';
  const secondary = dark ? '#bdcbe0' : '#445875';
  const accent = dark ? '#bdd7ff' : '#315bc7';
  const border = dark ? '#324360' : '#cfdaed';

  useEffect(() => {
    function offer(event: Event) {
      event.preventDefault();
      setInstall(event as InstallEvent);
    }
    function installed() { setInstall(null); }
    window.addEventListener('beforeinstallprompt', offer);
    window.addEventListener('appinstalled', installed);
    return () => {
      window.removeEventListener('beforeinstallprompt', offer);
      window.removeEventListener('appinstalled', installed);
    };
  }, []);

  return (
    <Animated.View entering={FadeIn.duration(180).reduceMotion(ReduceMotion.System)} style={styles.page}>
      <View style={[styles.hero, { backgroundColor: dark ? '#142744' : '#dce9ff', borderColor: border }]}>
        <Ionicons name="id-card-outline" size={40} color={accent} />
        <Text accessibilityRole="header" style={[styles.title, { color: ink }]}>One account. You decide what apps can access.</Text>
        <Text style={[styles.summary, { color: secondary }]}>Review your security, connected apps and sharing permissions from the X-Center ID dashboard.</Text>
        <View style={styles.actions}>
          <Pressable accessibilityRole="button" onPress={open} style={({ pressed }) => [styles.primary, pressed && styles.pressed]}>
            <Text style={styles.primaryText}>Open web app</Text>
            <Ionicons name="arrow-forward" size={17} color="white" />
          </Pressable>
          {install && <Pressable accessibilityRole="button" onPress={() => {
            setInstall(null);
            void install.prompt().catch(() => {});
          }} style={({ pressed }) => [styles.secondary, { borderColor: border }, pressed && styles.pressed]}>
            <Text style={[styles.label, { color: ink }]}>Install web app</Text>
          </Pressable>}
        </View>
      </View>
      <View style={[styles.cards, wide && styles.wide]}>
        {cards.map(([icon, title, description]) => (
          <View key={title} style={[styles.card, wide && styles.column, { borderColor: border }]}>
            <Ionicons name={icon} color={accent} size={25} />
            <Text style={[styles.label, { color: ink }]}>{title}</Text>
            <Text style={[styles.body, { color: secondary }]}>{description}</Text>
          </View>
        ))}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  page: { gap: 20 },
  hero: { gap: 17, padding: 28, borderRadius: 28, borderWidth: 1 },
  title: { fontSize: 40, fontWeight: '800', letterSpacing: -1.5, maxWidth: 650 },
  summary: { fontSize: 17, lineHeight: 26, maxWidth: 570 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  primary: { flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: '#264eb5', borderRadius: 12, minHeight: 48, paddingHorizontal: 16 },
  primaryText: { color: 'white', fontWeight: '700', fontSize: 16 },
  pressed: { opacity: 0.75 },
  secondary: { justifyContent: 'center', minHeight: 48, paddingHorizontal: 16, borderWidth: 1, borderRadius: 12 },
  cards: { gap: 12 },
  wide: { flexDirection: 'row' },
  column: { flex: 1 },
  card: { borderWidth: 1, borderRadius: 18, padding: 19, gap: 8 },
  label: { fontSize: 16, fontWeight: '700' },
  body: { fontSize: 15, lineHeight: 22 },
});
