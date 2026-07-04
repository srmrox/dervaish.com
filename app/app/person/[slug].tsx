import { Link, useLocalSearchParams } from "expo-router";

import { usePerson } from "@/src/api/hooks";
import { colors, space } from "@/src/theme/tokens";
import { AppText, Card, ErrorState, Loading, Screen } from "@/src/ui";

export default function PersonScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { data, isLoading, isError, error } = usePerson(slug);

  if (isLoading) return <Loading />;
  if (isError || !data) return <ErrorState message={(error as Error)?.message ?? "Not found"} />;

  return (
    <Screen>
      {data.name_native ? <AppText variant="display">{data.name_native}</AppText> : null}
      <AppText variant="title">{data.name}</AppText>
      <AppText variant="small" color={colors.soft}>
        {[data.era, data.region].filter(Boolean).join(" · ")}
      </AppText>
      {data.biography ? (
        <AppText variant="body" color={colors.muted} style={{ marginTop: space.sm }}>
          {data.biography}
        </AppText>
      ) : null}

      {data.authored_kalams.length ? (
        <>
          <AppText variant="title" style={{ marginTop: space.md }}>
            Authored kalam
          </AppText>
          {data.authored_kalams.map((k) => (
            <Link key={k.slug} href={`/kalam/${k.slug}`} asChild>
              <Card onPress={() => {}}>
                <AppText variant="body">{k.title}</AppText>
                {k.genre ? (
                  <AppText variant="small" color={colors.soft}>
                    {k.genre}
                  </AppText>
                ) : null}
              </Card>
            </Link>
          ))}
        </>
      ) : null}
    </Screen>
  );
}
