import { ArrowUp, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { useRequests, useUpvoteRequest } from "../lib/hooks";
import { useSession } from "../lib/session";
import { Button, Card, Chip, Empty, ErrorState, Loading } from "../ui";

const STATUS_TONE: Record<string, "green" | "blue" | "danger" | "muted" | "warning"> = {
  open: "blue",
  planned: "warning",
  fulfilled: "green",
  rejected: "danger",
};

export default function RequestsScreen() {
  const nav = useNavigate();
  const { isSignedIn } = useSession();
  const { data, isLoading, isError, error } = useRequests();
  const upvote = useUpvoteRequest();

  if (isLoading) return <Loading />;
  if (isError) return <ErrorState message={(error as Error).message} />;

  const results = data?.results ?? [];

  return (
    <div className="stack">
      <div className="between">
        <h1 className="u-display">Requests</h1>
        <Button icon={<Plus size={16} />} onClick={() => nav("/request")}>
          New request
        </Button>
      </div>

      {results.length ? (
        <div className="stack-sm">
          {results.map((r) => {
            const hints = [r.author_hint, r.reciter_hint].filter(Boolean).join(" · ");
            return (
              <Card key={r.id}>
                <div className="row">
                  <div className="grow stack-sm">
                    <div className="u-heading u-clamp1">{r.title}</div>
                    {hints ? <div className="u-soft u-small">{hints}</div> : null}
                    <Chip tone={STATUS_TONE[r.status] ?? "muted"}>{r.status}</Chip>
                  </div>
                  <Button
                    variant={r.has_upvoted ? "primary" : "secondary"}
                    size="sm"
                    icon={<ArrowUp size={14} />}
                    onClick={() => (isSignedIn ? upvote.mutate(r.id) : nav("/auth"))}
                  >
                    {r.upvotes}
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Empty title="No requests yet" hint="Be the first to request a kalam." />
      )}
    </div>
  );
}
