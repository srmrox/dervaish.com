import { Link, useNavigate } from "react-router-dom";

import { useLibrary } from "../lib/hooks";
import { formatDuration } from "../lib/format";
import { useSession } from "../lib/session";
import { Card, Chip, Empty, ErrorState, Loading, SectionHeader } from "../ui";

export default function LibraryScreen() {
  const nav = useNavigate();
  const { isSignedIn } = useSession();
  const library = useLibrary(isSignedIn);

  if (!isSignedIn) {
    return (
      <div className="stack">
        <Empty title="Sign in to build your library" hint="Save renditions to listen again later." />
        <div className="center">
          <Link to="/auth">Sign in</Link>
        </div>
      </div>
    );
  }

  if (library.isLoading) return <Loading />;
  if (library.isError) return <ErrorState message={(library.error as Error).message} />;

  const items = library.data?.results ?? [];

  return (
    <div className="stack">
      <SectionHeader title="Your library" />
      {items.length ? (
        <div className="stack-sm">
          {items.map((item) => {
            const r = item.rendition_detail;
            return (
              <Card key={r.slug} onClick={() => nav(`/rendition/${r.slug}`)}>
                <div className="row">
                  <div className="art" style={{ width: 48, flexShrink: 0 }} />
                  <div className="grow stack-sm">
                    <div className="u-heading u-clamp1">{r.title}</div>
                    <div className="u-soft u-small">{r.kalam_title}</div>
                  </div>
                  {r.has_media ? (
                    <span className="u-soft u-small u-tabular">{formatDuration(r.duration_ms)}</span>
                  ) : (
                    <Chip tone="warning">unavailable</Chip>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Empty title="Nothing saved yet" hint="Save renditions from Listen to find them here." />
      )}
    </div>
  );
}
