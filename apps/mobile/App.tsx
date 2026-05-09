import { StatusBar } from "expo-status-bar";
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { demoCatalog } from "@dervaish/domain";
import { activeLyricSegment, dirForLanguage, textAlignForDirection } from "@dervaish/playback-core";

const track = demoCatalog.tracks[0];
const collection = demoCatalog.collections[0];
const archive = demoCatalog.archiveRecords[0];
const submission = demoCatalog.submissions[0];
const segment = activeLyricSegment(track.lyricSet, 17000);
const originalLanguage = track.lyricSet.languages[0];
const translationLanguage = track.lyricSet.languages[1];
const originalDirection = dirForLanguage(originalLanguage);
const translationDirection = dirForLanguage(translationLanguage);
const reciters = track.reciterIds.map((id) => demoCatalog.people.find((person) => person.id === id)?.name).filter(Boolean).join(", ");
const writers = track.writerIds.map((id) => demoCatalog.people.find((person) => person.id === id)?.name).filter(Boolean).join(", ");
const requestCount = demoCatalog.trackRequests.length;
const trackUpvotes = track.upvoteCount ?? 0;
const verificationSummary = submission.verificationSummary?.overall ?? { verify: 0, dispute: 0 };
const mediaSources = [...new Set([...track.mediaAssets.map((asset) => asset.urlSource ?? "storage"), ...demoCatalog.mediaMirrors.filter((mirror) => mirror.trackId === track.id).map((mirror) => mirror.urlSource ?? "external")])].join(", ");

export default function App() {
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.brand}>Dervaish</Text>
          <Text style={styles.role}>anonymous session</Text>
        </View>

        <View style={styles.listenCard}>
          <Text style={styles.section}>Listen</Text>
          <Text style={styles.title}>{collection.title}</Text>
          <Text style={styles.body}>
            {track.title} is pinned for offline playback with {track.lyricSet.languages.length} lyric languages and archive context.
          </Text>
          <Text style={styles.body}>Reciter: {reciters}</Text>
          <Text style={styles.body}>Writer: {writers}</Text>
          <Text style={styles.body}>Media sources: {mediaSources}</Text>
          <View style={styles.playbackStrip}>
            <Text style={styles.playButton}>Play</Text>
            <Text style={styles.body}>0:17 / 4:18</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.section}>Companion</Text>
          <Text style={styles.heading}>{track.title}</Text>
          <Text style={styles.body}>Curated Collection: {collection.title}</Text>
          <Text style={styles.body}>Reciter: {reciters}</Text>
          <Text style={styles.body}>Writer: {writers}</Text>
          <Text style={styles.body}>Shown languages: {track.lyricSet.languages.slice(0, 2).map((language) => language.name).join(", ")}</Text>
          <Text style={styles.body}>{archive.title}</Text>
          <View style={styles.activeLyricBlock}>
            <Text style={[styles.activeLyric, { writingDirection: originalDirection, textAlign: textAlignForDirection(originalDirection) }]}>
              {segment?.textByLanguageId[originalLanguage.id]}
            </Text>
            <Text style={[styles.translation, { writingDirection: translationDirection, textAlign: textAlignForDirection(translationDirection) }]}>
              {segment?.textByLanguageId[translationLanguage.id]}
            </Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.section}>Submit</Text>
          <Text style={styles.heading}>{submission.title}</Text>
          <Text style={styles.body}>{submission.notes}</Text>
          <View style={styles.row}>
            <View style={styles.pill}>
              <Text style={styles.pillLabel}>status</Text>
              <Text style={styles.pillValue}>{submission.moderationStatus.replace("_", " ")}</Text>
            </View>
            <View style={styles.pill}>
              <Text style={styles.pillLabel}>lyrics</Text>
              <Text style={styles.pillValue}>{submission.lyricSet.languages.length} languages</Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.section}>Community</Text>
          <Text style={styles.heading}>{requestCount} track request queued</Text>
          <Text style={styles.body}>{track.title} has {trackUpvotes} community upvotes.</Text>
          <Text style={styles.body}>
            Overall verification: {verificationSummary.verify} verified / {verificationSummary.dispute} disputed
          </Text>
        </View>

        <View style={styles.adminNotice}>
          <Text style={styles.section}>Admin</Text>
          <Text style={styles.body}>
            Video generation and moderation tools stay hidden until an editor or admin session is active.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#050706"
  },
  container: {
    padding: 20,
    gap: 14
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8
  },
  brand: {
    color: "#f4f7f4",
    fontSize: 24,
    fontWeight: "900"
  },
  role: {
    color: "#98a59d",
    fontSize: 13
  },
  listenCard: {
    backgroundColor: "#111514",
    borderRadius: 8,
    padding: 18,
    gap: 10
  },
  card: {
    backgroundColor: "#111514",
    borderRadius: 8,
    padding: 18,
    gap: 8
  },
  adminNotice: {
    backgroundColor: "#0b0f0d",
    borderRadius: 8,
    padding: 18,
    gap: 8
  },
  section: {
    color: "#20d760",
    textTransform: "uppercase",
    letterSpacing: 1.2,
    fontSize: 12,
    fontWeight: "900"
  },
  title: {
    color: "#f4f7f4",
    fontSize: 34,
    fontWeight: "900"
  },
  heading: {
    color: "#f4f7f4",
    fontSize: 21,
    fontWeight: "800"
  },
  body: {
    color: "#98a59d",
    fontSize: 15,
    lineHeight: 22
  },
  playbackStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 10
  },
  playButton: {
    backgroundColor: "#20d760",
    color: "#031006",
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 10,
    fontWeight: "900"
  },
  activeLyricBlock: {
    borderLeftWidth: 4,
    borderLeftColor: "#20d760",
    backgroundColor: "rgba(32, 215, 96, 0.10)",
    padding: 14,
    borderRadius: 8
  },
  activeLyric: {
    color: "#f4f7f4",
    fontSize: 18,
    lineHeight: 28
  },
  translation: {
    color: "#c5cec8",
    fontSize: 15,
    lineHeight: 22,
    marginTop: 6
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 8
  },
  pill: {
    backgroundColor: "#171d1b",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  pillLabel: {
    color: "#98a59d",
    fontSize: 11,
    textTransform: "uppercase"
  },
  pillValue: {
    color: "#f4f7f4",
    fontSize: 14,
    fontWeight: "800"
  }
});
