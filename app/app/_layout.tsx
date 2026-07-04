import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DarkTheme, Stack, ThemeProvider } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View } from "react-native";
import "react-native-reanimated";

import { MiniPlayer } from "@/src/player/MiniPlayer";
import { PlayerProvider } from "@/src/player/PlayerProvider";
import { colors } from "@/src/theme/tokens";

export { ErrorBoundary } from "expo-router";

export const unstable_settings = { initialRouteName: "(tabs)" };

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 60_000, retry: 1 } },
});

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.bg,
    card: colors.nav,
    text: colors.text,
    border: colors.line,
    primary: colors.green,
  },
};

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <PlayerProvider>
        <ThemeProvider value={navTheme}>
          <View style={{ flex: 1, backgroundColor: colors.bg }}>
            <Stack>
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="kalam/[slug]" options={{ title: "Kalam" }} />
              <Stack.Screen name="person/[slug]" options={{ title: "Person" }} />
            </Stack>
            <MiniPlayer />
            <StatusBar style="light" />
          </View>
        </ThemeProvider>
      </PlayerProvider>
    </QueryClientProvider>
  );
}
