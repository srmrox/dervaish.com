import { AppText, Empty, Screen } from "@/src/ui";

export default function LibraryScreen() {
  // Library is owner-scoped (/me/library) and needs auth, which arrives in M6.
  return (
    <Screen>
      <AppText variant="display">Library</AppText>
      <Empty
        title="Sign in to build your library"
        hint="Saving renditions, playlists, and queues arrives with accounts (M6)."
      />
    </Screen>
  );
}
