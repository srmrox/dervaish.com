import { Link } from "expo-router";

import { useCollections, useKalams } from "@/src/api/hooks";
import type { KalamListItem } from "@/src/api/types";
import { colors, space } from "@/src/theme/tokens";
import { AppText, Card, Empty, ErrorState, Loading, Pill, Screen } from "@/src/ui";

export default function ListenScreen() {
  const kalams = useKalams();
  const collections = useCollections();

  if (kalams.isLoading) return <Loading />;
  if (kalams.isError) return <ErrorState message={(kalams.error as Error).message} />;

  const items = kalams.data?.results ?? [];

  return (
    <Screen>
      <AppText variant="display">Listen</AppText>

      {collections.data?.results?.length ? (
        <>
          <AppText variant="title" style={{ marginTop: space.sm }}>
            Collections
          </AppText>
          {collections.data.results.map((c) => (
            <Card key={c.slug}>
              <AppText variant="body">{c.title}</AppText>
              <AppText variant="small" color={colors.muted}>
                {c.rendition_count} renditions{c.is_curated ? " · curated" : ""}
              </AppText>
            </Card>
          ))}
        </>
      ) : null}

      <AppText variant="title" style={{ marginTop: space.sm }}>
        Kalam
      </AppText>
      {items.length === 0 ? (
        <Empty title="No kalam yet" hint="Seed the backend or add content in admin." />
      ) : (
        items.map((k) => <KalamRow key={k.slug} kalam={k} />)
      )}
    </Screen>
  );
}

function KalamRow({ kalam }: { kalam: KalamListItem }) {
  return (
    <Link href={`/kalam/${kalam.slug}`} asChild>
      <Card onPress={() => {}}>
        <AppText variant="body">{kalam.title}</AppText>
        {kalam.title_native ? (
          <AppText variant="small" color={colors.muted}>
            {kalam.title_native}
          </AppText>
        ) : null}
        <AppText variant="small" color={colors.soft}>
          {kalam.author_name ?? "Unknown author"}
        </AppText>
        {kalam.genre ? <Pill label={kalam.genre} /> : null}
      </Card>
    </Link>
  );
}
