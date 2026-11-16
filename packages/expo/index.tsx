import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';

export type AccountEntryProps = {
  onSignIn?: () => void;
  onCreateAccount?: () => void;
  pending?: boolean;
  error?: string;
  children?: ReactNode;
};

export function AccountEntry({ onSignIn, onCreateAccount, pending = false, error, children }: AccountEntryProps) {
  const dark = useColorScheme() === 'dark';
  const ink = dark ? '#f4f7ff' : '#142438';
  const color = dark ? '#a8c7ff' : '#174eaa';
  const panel = dark ? '#203a61' : '#e4edff';
  const action = dark ? '#375fce' : '#214fbe';
  const muted = dark ? '#b1c1dc' : '#526078';

  return (
    <View style={[styles.card, { backgroundColor: dark ? '#192433' : '#fff' }]}>
      <Text style={[styles.brand, { color }]}>X-Center ID</Text>
      <Text accessibilityRole="header" style={[styles.title, { color: ink }]}>Sign in with X-Center ID</Text>
      <Text style={{ color: muted }}>Use a passkey or security key in your browser.</Text>
      {!onSignIn && <Text style={{ color: ink }}>Live sign-in is unavailable in this preview.</Text>}
      {error && <Text accessibilityRole="alert" style={{ color: ink }}>{error}</Text>}
      {pending && <ActivityIndicator accessibilityLabel="Opening sign-in" color={color} />}
      <View style={styles.actions}>
        {onSignIn && <Pressable accessibilityRole="button" accessibilityState={{ disabled: pending }} disabled={pending} onPress={onSignIn}
          style={({ pressed }) => [styles.button, { backgroundColor: action, opacity: pressed ? 0.8 : 1 }]}>
          <Text style={{ color: '#fff', fontWeight: '700' }}>Continue to X-Center ID</Text>
        </Pressable>}
        {onCreateAccount && <Pressable accessibilityRole="button" accessibilityState={{ disabled: pending }} disabled={pending} onPress={onCreateAccount}
          style={({ pressed }) => [styles.button, { backgroundColor: panel, opacity: pressed ? 0.7 : 1 }]}>
          <Text style={{ color, fontWeight: '700' }}>Create an account</Text>
        </Pressable>}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 10, borderRadius: 20, padding: 18 },
  brand: { fontSize: 14, fontWeight: '800', letterSpacing: .2 },
  title: { fontSize: 24, fontWeight: '800' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  button: { minHeight: 48, justifyContent: 'center', borderRadius: 12, paddingHorizontal: 14 },
});
