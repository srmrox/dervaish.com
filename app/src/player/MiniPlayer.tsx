import { Feather } from "@expo/vector-icons";
import { Pressable, StyleSheet, View } from "react-native";

import { AppText, formatDuration } from "@/src/ui";
import { colors, radius, space } from "@/src/theme/tokens";

import { usePlayer } from "./PlayerProvider";

export function MiniPlayer() {
  const { current, isPlaying, positionMs, durationMs, toggle } = usePlayer();
  if (!current) return null;

  const progress = durationMs ? Math.min(1, positionMs / durationMs) : 0;

  return (
    <View style={s.bar}>
      <View style={s.track}>
        <View style={[s.fill, { width: `${progress * 100}%` }]} />
      </View>
      <View style={s.row}>
        <View style={s.meta}>
          <AppText variant="small" numberOfLines={1}>
            {current.title || "Rendition"}
          </AppText>
          <AppText variant="tiny" color={colors.muted}>
            {formatDuration(positionMs)} / {formatDuration(durationMs || current.duration_ms)}
          </AppText>
        </View>
        <Pressable
          onPress={toggle}
          style={s.btn}
          accessibilityRole="button"
          accessibilityLabel={isPlaying ? "Pause" : "Play"}
        >
          <Feather name={isPlaying ? "pause" : "play"} size={20} color={colors.bg} />
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  bar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.nav,
    borderTopColor: colors.line,
    borderTopWidth: 1,
  },
  track: { height: 2, backgroundColor: colors.surface3 },
  fill: { height: 2, backgroundColor: colors.green },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    gap: space.md,
  },
  meta: { flex: 1, gap: 2 },
  btn: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.green,
    alignItems: "center",
    justifyContent: "center",
  },
});
