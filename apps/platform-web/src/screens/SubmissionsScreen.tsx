import { Link } from "react-router-dom";

import { useMySubmissions } from "../lib/hooks";
import { useSession } from "../lib/session";
import { Card, Chip, Empty, ErrorState, Loading, Pill } from "../ui";

const STATUS_TONE: Record<string, "green" | "blue" | "danger" | "muted"> = {
  submitted: "blue",
  approved: "green",
  published: "green",
  rejected: "danger",
};

export default function SubmissionsScreen() {
  const { isSignedIn } = useSession();
  const { data, isLoading, isError, error } = useMySubmissions(isSignedIn);

  if (!isSignedIn) {
    return (
      <div className="stack">
        <Empty title="Sign in to view your submissions" />
        <div className="center">
          <Link to="/auth">Sign in</Link>
        </div>
      </div>
    );
  }
  if (isLoading) return <Loading />;
  if (isError) return <ErrorState message={(error as Error).message} />;

  const results = data?.results ?? [];

  return (
    <div className="stack">
      <h1 className="u-display">My submissions</h1>
      {results.length ? (
        <div className="stack-sm">
          {results.map((s) => (
            <Card key={s.id}>
              <div className="between">
                <div className="u-heading u-clamp1 grow">{s.title}</div>
                {s.payload.kind ? <Pill>{s.payload.kind}</Pill> : null}
              </div>
              <div className="row wrap">
                <Chip tone={STATUS_TONE[s.status] ?? "muted"}>{s.status}</Chip>
                <span className="u-tiny u-soft">{new Date(s.created_at).toLocaleDateString()}</span>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Empty title="No submissions yet" hint="Contribute from the Studio to see them here." />
      )}
    </div>
  );
}
