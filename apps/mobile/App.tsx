import { StatusBar } from "expo-status-bar";
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { demoCatalog } from "@dervaish/domain";
import { activeLyricLine } from "@dervaish/playback-core";

const track = demoCatalog.tracks[0];
const release = demoCatalog.releases[0];
const archive = demoCatalog.archiveRecords[0];
const line = activeLyricLine(track, 17000);

export default function App() {
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.eyebrow}>Dervaish mobile</Text>
        <Text style={styles.title}>{release.title}</Text>
        <Text style={styles.body}>
          Offline-first listening, synced lyrics, and archive evidence are organized into one mobile-first library.
        </Text>

        <View style={styles.card}>
          <Text style={styles.section}>Downloaded library</Text>
          <Text style={styles.heading}>{track.title}</Text>
          <Text style={styles.body}>Pinned for offline use with lyrics, artwork, and archive citations.</Text>
          <Text style={styles.activeLyric}>{line}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.section}>Archive context</Text>
          <Text style={styles.heading}>{archive.title}</Text>
          <Text style={styles.body}>{archive.summary}</Text>
          <View style={styles.row}>
            {archive.ratings.map((rating) => (
              <View key={rating.id} style={styles.pill}>
                <Text style={styles.pillLabel}>{rating.kind}</Text>
                <Text style={styles.pillValue}>
                  {rating.value}/{rating.maxValue}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#09110f"
  },
  container: {
    padding: 24,
    gap: 18
  },
  eyebrow: {
    color: "#7af3d1",
    textTransform: "uppercase",
    letterSpacing: 2,
    fontSize: 12
  },
  title: {
    color: "#f4f5eb",
    fontSize: 36,
    fontWeight: "700"
  },
  section: {
    color: "#d5ff72",
    textTransform: "uppercase",
    letterSpacing: 1.5,
    fontSize: 12,
    marginBottom: 8
  },
  heading: {
    color: "#f4f5eb",
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 8
  },
  body: {
    color: "#aac0b2",
    fontSize: 15,
    lineHeight: 22
  },
  activeLyric: {
    color: "#f4f5eb",
    fontSize: 18,
    marginTop: 14
  },
  card: {
    backgroundColor: "#10211d",
    borderRadius: 24,
    padding: 20,
    gap: 6
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 14
  },
  pill: {
    backgroundColor: "#17302a",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  pillLabel: {
    color: "#7af3d1",
    fontSize: 11,
    textTransform: "uppercase"
  },
  pillValue: {
    color: "#f4f5eb",
    fontSize: 14,
    fontWeight: "700"
  }
});
