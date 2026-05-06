import { StatusBar } from "expo-status-bar";
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { demoCatalog } from "@dervaish/domain";
import { activeLyricSegment } from "@dervaish/playback-core";

const track = demoCatalog.tracks[0];
const release = demoCatalog.releases[0];
const archive = demoCatalog.archiveRecords[0];
const submission = demoCatalog.submissions[0];
const segment = activeLyricSegment(track.lyricSet, 17000);

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
          <Text style={styles.title}>{release.title}</Text>
          <Text style={styles.body}>
            {track.title} is pinned for offline playback with {track.lyricSet.languages.length} lyric languages and archive context.
          </Text>
          <View style={styles.playbackStrip}>
            <Text style={styles.playButton}>Play</Text>
            <Text style={styles.body}>0:17 / 4:18</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.section}>Companion</Text>
          <Text style={styles.heading}>{track.title}</Text>
          <Text style={styles.body}>{archive.title}</Text>
          <View style={styles.activeLyricBlock}>
            <Text style={styles.activeLyric}>{segment?.textByLanguageId[track.lyricSet.languages[0].id]}</Text>
            <Text style={styles.translation}>{segment?.textByLanguageId[track.lyricSet.languages[1].id]}</Text>
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
