import { useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { Link } from "expo-router";

import { useSearch } from "@/src/api/hooks";
import { colors, radius, space } from "@/src/theme/tokens";
import { AppText, Card, Empty, ErrorState, Loading, Screen } from "@/src/ui";

export default function SearchScreen() {
  const [q, setQ] = useState("");
  const { data, isLoading, isError, error } = useSearch(q);

  return (
    <Screen>
      <AppText variant="display">Search</AppText>
      <View style={s.field}>
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Search kalam, people, renditions…"
          placeholderTextColor={colors.soft}
          style={s.input}
          autoCorrect={false}
        />
      </View>

      {q.trim().length === 0 ? (
        <Empty title="Start typing to search" />
      ) : isLoading ? (
        <Loading />
      ) : isError ? (
        <ErrorState message={(error as Error).message} />
      ) : (
        <>
          <Section title="Kalam">
            {data?.kalams.map((k) => (
              <Link key={k.slug} href={`/kalam/${k.slug}`} asChild>
                <Card onPress={() => {}}>
                  <AppText variant="body">{k.title}</AppText>
                  <AppText variant="small" color={colors.soft}>
                    {k.author_name ?? "Unknown"}
                  </AppText>
                </Card>
              </Link>
            ))}
          </Section>
          <Section title="People">
            {data?.people.map((p) => (
              <Link key={p.slug} href={`/person/${p.slug}`} asChild>
                <Card onPress={() => {}}>
                  <AppText variant="body">{p.name}</AppText>
                  {p.era ? (
                    <AppText variant="small" color={colors.soft}>
                      {p.era}
                    </AppText>
                  ) : null}
                </Card>
              </Link>
            ))}
          </Section>
          {!data?.kalams.length && !data?.people.length ? (
            <Empty title={`No results for “${q}”`} />
          ) : null}
        </>
      )}
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const hasChildren = Array.isArray(children) ? children.some(Boolean) : !!children;
  if (!hasChildren) return null;
  return (
    <>
      <AppText variant="title" style={{ marginTop: space.sm }}>
        {title}
      </AppText>
      {children}
    </>
  );
}

const s = StyleSheet.create({
  field: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: radius.control,
    paddingHorizontal: space.md,
  },
  input: { color: colors.text, paddingVertical: space.md, fontSize: 15 },
});
