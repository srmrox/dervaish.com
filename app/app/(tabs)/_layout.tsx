import { Feather } from "@expo/vector-icons";
import { Tabs } from "expo-router";

import { colors } from "@/src/theme/tokens";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.green,
        tabBarInactiveTintColor: colors.soft,
        tabBarStyle: { backgroundColor: colors.nav, borderTopColor: colors.line },
        headerStyle: { backgroundColor: colors.nav },
        headerTintColor: colors.text,
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Listen",
          tabBarIcon: ({ color, size }) => <Feather name="headphones" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: "Search",
          tabBarIcon: ({ color, size }) => <Feather name="search" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: "Library",
          tabBarIcon: ({ color, size }) => <Feather name="bookmark" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
