import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps, ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

export type DashboardTheme = {
  background: string;
  panel: string;
  ink: string;
  muted: string;
  accent: string;
  soft: string;
  line: string;
  mint: string;
  mintInk: string;
  lavender: string;
  lavenderInk: string;
  danger: string;
};

export const dashboardThemes = {
  light: {
    background: '#f6f8fc', panel: '#ffffff', ink: '#141b2e', muted: '#526078',
    accent: '#214fbe', soft: '#e9f0ff', line: '#dee4ee', mint: '#dcf6ef',
    mintInk: '#135f51', lavender: '#eee8ff', lavenderInk: '#5136a5', danger: '#a42635',
  },
  dark: {
    background: '#101522', panel: '#192132', ink: '#f3f6ff', muted: '#b1c1dc',
    accent: '#9ebcff', soft: '#23355d', line: '#33415a', mint: '#143a34',
    mintInk: '#85e2c8', lavender: '#302747', lavenderInk: '#d2b9ff', danger: '#ffa8ad',
  },
} satisfies Record<string, DashboardTheme>;

type Icon = ComponentProps<typeof Ionicons>['name'];
type Tint = 'blue' | 'mint' | 'lavender';

export function Surface({ colors, children }: { colors: DashboardTheme; children: ReactNode }) {
  return <View style={[styles.surface, { backgroundColor: colors.panel, borderColor: colors.line }]}>{children}</View>;
}

export function SymbolTile({ colors, icon, tint = 'blue' }: { colors: DashboardTheme; icon: Icon; tint?: Tint }) {
  const [backgroundColor, color] = {
    blue: [colors.soft, colors.accent],
    mint: [colors.mint, colors.mintInk],
    lavender: [colors.lavender, colors.lavenderInk],
  }[tint];
  return <View style={[styles.tile, { backgroundColor }]}><Ionicons accessible={false} name={icon} size={21} color={color} /></View>;
}

export function SurfaceTitle({ colors, title, icon, tint }: {
  colors: DashboardTheme; title: string; icon: Icon; tint?: Tint;
}) {
  return <View style={styles.heading}>
    <SymbolTile colors={colors} icon={icon} tint={tint} />
    <Text accessibilityRole="header" style={[styles.title, { color: colors.ink }]}>{title}</Text>
  </View>;
}

const styles = StyleSheet.create({
  surface: { padding: 16, gap: 12, borderRadius: 20, borderWidth: 1 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontSize: 18, fontWeight: '700', flexShrink: 1 },
  tile: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
});
