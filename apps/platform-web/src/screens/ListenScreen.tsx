import { Link, useNavigate } from "react-router-dom";

import { useCollections, useKalams } from "../lib/hooks";
import { useSession } from "../lib/session";
import { Card, Empty, ErrorState, Loading, Pill, SectionHeader } from "../ui";

export default function ListenScreen() {
  const nav = useNavigate();
  const { isSignedIn } = useSession();
  const kalams = useKalams();
  const collections = useCollections();

  if (kalams.isLoading || collections.isLoading) return <Loading />;
  if (kalams.isError) return <ErrorState message={(kalams.error as Error).message} />;
  if (collections.isError) return <ErrorState message={(collections.error as Error).message} />;

  const kalamList = kalams.data?.results ?? [];
  const curated = (collections.data?.results ?? []).filter((c) => c.is_curated);

  return (
    <div className="stack">
      <div className="stack-sm">
        <h1 className="u-display">Listen</h1>
        <p className="u-soft u-small">Discover kalam, renditions, and curated collections.</p>
        {isSignedIn ? (
          <Link to="/library" className="u-small">
            Your library →
          </Link>
        ) : null}
      </div>

      {curated.length ? (
        <>
          <SectionHeader title="Curated collections" />
          <div className="grid-cards">
            {curated.map((c) => (
              <Card key={c.slug} onClick={() => nav(`/collection/${c.slug}`)}>
                <div className="u-heading">{c.title}</div>
                <div className="u-soft u-small">{c.rendition_count} renditions</div>
              </Card>
            ))}
          </div>
        </>
      ) : null}

      <SectionHeader title="Kalam" />
      {kalamList.length ? (
        <div className="stack-sm">
          {kalamList.map((k) => (
            <Card key={k.slug} onClick={() => nav(`/kalam/${k.slug}`)}>
              <div className="row">
                <div className="art" style={{ width: 48, flexShrink: 0 }} />
                <div className="grow stack-sm">
                  <div className="u-heading u-clamp1">{k.title}</div>
                  <div className="u-soft u-small">{k.author_name ?? "Unknown author"}</div>
                </div>
                {k.genre ? <Pill>{k.genre}</Pill> : null}
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Empty title="No published kalam yet" hint="Check back soon." />
      )}
    </div>
  );
}
