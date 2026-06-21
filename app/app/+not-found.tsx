import { Link, Stack } from "expo-router";

import { colors, space } from "@/src/theme/tokens";
import { AppText, Screen } from "@/src/ui";

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: "Not found" }} />
      <Screen>
        <AppText variant="title">This screen doesn’t exist.</AppText>
        <Link href="/" style={{ marginTop: space.md }}>
          <AppText color={colors.blue}>Go to Listen</AppText>
        </Link>
      </Screen>
    </>
  );
}
