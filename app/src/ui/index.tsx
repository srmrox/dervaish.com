import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { colors, font, radius, space } from "@/src/theme/tokens";

type TextVariant = "display" | "title" | "body" | "small" | "tiny";

export function AppText({
  children,
  variant = "body",
  color = colors.text,
  style,
  numberOfLines,
}: {
  children: React.ReactNode;
  variant?: TextVariant;
  color?: string;
  style?: object;
  numberOfLines?: number;
}) {
  const size = font[variant];
  const weight = variant === "display" || variant === "title" ? "700" : "400";
  return (
    <Text style={[{ color, fontSize: size, fontWeight: weight }, style]} numberOfLines={numberOfLines}>
      {children}
    </Text>
  );
}

export function Screen({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView style={s.screen} contentContainerStyle={s.screenContent}>
      {children}
    </ScrollView>
  );
}

export function Card({
  children,
  onPress,
}: {
  children: React.ReactNode;
  onPress?: () => void;
}) {
  const Wrapper: typeof Pressable | typeof View = onPress ? Pressable : View;
  return (
    <Wrapper style={s.card} onPress={onPress}>
      {children}
    </Wrapper>
  );
}

export function Pill({ label, tone = "muted" }: { label: string; tone?: "muted" | "green" | "gold" }) {
  const bg = tone === "green" ? colors.greenSoft : colors.surface3;
  const fg = tone === "green" ? colors.green : tone === "gold" ? colors.gold : colors.muted;
  return (
    <View style={[s.pill, { backgroundColor: bg }]}>
      <Text style={{ color: fg, fontSize: font.tiny, fontWeight: "600" }}>{label}</Text>
    </View>
  );
}

export function Loading() {
  return (
    <View style={s.center}>
      <ActivityIndicator color={colors.green} />
    </View>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <View style={s.center}>
      <AppText color={colors.danger}>Couldn’t load</AppText>
      <AppText variant="small" color={colors.muted}>
        {message}
      </AppText>
    </View>
  );
}

export function Empty({ title, hint }: { title: string; hint?: string }) {
  return (
    <View style={s.center}>
      <AppText color={colors.muted}>{title}</AppText>
      {hint ? (
        <AppText variant="small" color={colors.soft}>
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}

export function formatDuration(ms: number): string {
  const total = Math.round(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = total % 60;
  const mm = h ? String(m).padStart(2, "0") : String(m);
  return `${h ? `${h}:` : ""}${mm}:${String(sec).padStart(2, "0")}`;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  screenContent: { padding: space.lg, gap: space.md, paddingBottom: space.xxl * 3 },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: radius.panel,
    padding: space.lg,
    gap: space.xs,
  },
  pill: {
    alignSelf: "flex-start",
    paddingHorizontal: space.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  center: { padding: space.xl, alignItems: "center", gap: space.xs },
});
