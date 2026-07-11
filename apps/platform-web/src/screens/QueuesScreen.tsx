import { Link, useNavigate } from "react-router-dom";

import { useQueues } from "../lib/hooks";
import { formatDuration } from "../lib/format";
import { useSession } from "../lib/session";
import { Card, Chip, Empty, ErrorState, Loading, SectionHeader } from "../ui";

export default function QueuesScreen() {
  const nav = useNavigate();
  const { isSignedIn } = useSession();
  const queues = useQueues(isSignedIn);

  if (!isSignedIn) {
    return (
      <div className="stack">
        <Empty title="Sign in to view your queues" hint="Build listening queues from Listen." />
        <div className="center">
          <Link to="/auth">Sign in</Link>
        </div>
      </div>
    );
  }

  if (queues.isLoading) return <Loading />;
  if (queues.isError) return <ErrorState message={(queues.error as Error).message} />;

  const items = [...(queues.data?.results ?? [])].sort((a, b) => a.position - b.position);

  return (
    <div className="stack">
      <SectionHeader title="Queue" />
      {items.length ? (
        <div className="stack-sm">
          {items.map((item) => {
            const r = item.rendition_detail;
            return (
              <Card key={r.slug} onClick={() => nav(`/rendition/${r.slug}`)}>
                <div className="row">
                  <span className="u-soft u-small u-tabular" style={{ width: 24 }}>
                    {item.position}
                  </span>
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
        <Empty title="Your queue is empty" hint="Create a queue from Listen." />
      )}
    </div>
  );
}
