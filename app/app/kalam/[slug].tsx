import { Feather } from "@expo/vector-icons";
import { Link, useLocalSearchParams } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";

import { useKalam } from "@/src/api/hooks";
import type { KalamDetail, Rendition, Verse } from "@/src/api/types";
import { dirFor, isRTL } from "@/src/i18n/rtl";
import { usePlayer } from "@/src/player/PlayerProvider";
import { colors, radius, space } from "@/src/theme/tokens";
import { AppText, Card, ErrorState, Loading, Pill, Screen, formatDuration } from "@/src/ui";

export default function KalamScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { data, isLoading, isError, error } = useKalam(slug);

  if (isLoading) return <Loading />;
  if (isError || !data) return <ErrorState message={(error as Error)?.message ?? "Not found"} />;

  const lang = data.primary_language;

  return (
    <Screen>
      <View style={{ gap: space.xs }}>
        {data.title_native ? (
          <AppText variant="display" style={{ writingDirection: dirFor(lang) }}>
            {data.title_native}
          </AppText>
        ) : null}
        <AppText variant="title">{data.title}</AppText>
        {data.author ? (
          <Link href={`/person/${data.author.slug}`} asChild>
            <Pressable>
              <AppText variant="body" color={colors.blue}>
                {data.author.name}
              </AppText>
            </Pressable>
          </Link>
        ) : null}
        <View style={s.pills}>
          {data.genre ? <Pill label={data.genre} /> : null}
          {data.tradition ? <Pill label={data.tradition} tone="gold" /> : null}
          {data.primary_language ? <Pill label={data.primary_language} /> : null}
        </View>
        {data.summary ? (
          <AppText variant="small" color={colors.muted}>
            {data.summary}
          </AppText>
        ) : null}
      </View>

      <AppText variant="title" style={{ marginTop: space.md }}>
        Renditions
      </AppText>
      {data.renditions.length ? (
        data.renditions.map((r) => <RenditionRow key={r.slug} rendition={r} />)
      ) : (
        <AppText variant="small" color={colors.soft}>
          No renditions published yet.
        </AppText>
      )}

      <AppText variant="title" style={{ marginTop: space.md }}>
        Text
      </AppText>
      {data.verses.map((v) => (
        <VerseBlock key={v.order} verse={v} lang={lang} />
      ))}
    </Screen>
  );
}

function RenditionRow({ rendition }: { rendition: Rendition }) {
  const { play, current, isPlaying, toggle } = usePlayer();
  const active = current?.slug === rendition.slug;
  const reciter = rendition.credits.find((c) => c.role === "reciter");
  return (
    <Card>
      <View style={s.renditionRow}>
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="body">{rendition.title || "Rendition"}</AppText>
          <AppText variant="small" color={colors.soft}>
            {reciter?.person_name ?? "Unknown reciter"}
            {rendition.year ? ` · ${rendition.year}` : ""} · {formatDuration(rendition.duration_ms)}
          </AppText>
        </View>
        <Pressable
          onPress={() => (active ? toggle() : play(rendition))}
          style={s.playBtn}
          accessibilityRole="button"
          accessibilityLabel={active && isPlaying ? "Pause" : "Play"}
        >
          <Feather name={active && isPlaying ? "pause" : "play"} size={18} color={colors.bg} />
        </Pressable>
      </View>
    </Card>
  );
}

function VerseBlock({ verse, lang }: { verse: Verse; lang: KalamDetail["primary_language"] }) {
  const rtl = isRTL(lang);
  const translation = verse.translations.en ?? Object.values(verse.translations)[0];
  const meaning = verse.meaning.en ?? Object.values(verse.meaning)[0];
  return (
    <Card>
      {verse.text_native ? (
        <AppText
          variant="body"
          style={{ writingDirection: rtl ? "rtl" : "ltr", textAlign: rtl ? "right" : "left" }}
        >
          {verse.text_native}
        </AppText>
      ) : null}
      {verse.transliteration ? (
        <AppText variant="small" color={colors.muted}>
          {verse.transliteration}
        </AppText>
      ) : null}
      {translation ? (
        <AppText variant="small" color={colors.text}>
          {translation}
        </AppText>
      ) : null}
      {meaning ? (
        <AppText variant="tiny" color={colors.gold}>
          {meaning}
        </AppText>
      ) : null}
    </Card>
  );
}

const s = StyleSheet.create({
  pills: { flexDirection: "row", flexWrap: "wrap", gap: space.xs, marginTop: space.xs },
  renditionRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  playBtn: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    backgroundColor: colors.green,
    alignItems: "center",
    justifyContent: "center",
  },
});
