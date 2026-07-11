import { Upload } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

import { useKalams, useMySubmissions } from "../lib/hooks";
import { atLeast, useSession } from "../lib/session";
import { Button, Card, Chip, Empty, ErrorState, Loading, Pill, SectionHeader } from "../ui";

const STATUS_TONE: Record<string, "green" | "blue" | "danger" | "muted"> = {
  submitted: "blue",
  approved: "green",
  published: "green",
  rejected: "danger",
};

export default function StudioScreen() {
  const nav = useNavigate();
  const { role, isSignedIn } = useSession();
  const kalams = useKalams();
  const subs = useMySubmissions(true);

  if (!isSignedIn || !atLeast(role, "contributor")) {
    return (
      <div className="stack">
        <Empty title="Contributors only" hint="Sign in with a contributor account to access the Studio." />
        <div className="center">
          <Link to="/auth">Sign in</Link>
        </div>
      </div>
    );
  }

  const kalamList = (kalams.data?.results ?? []).slice(0, 5);
  const mySubs = (subs.data?.results ?? []).slice(0, 3);

  return (
    <div className="stack">
      <div className="between">
        <h1 className="u-display">Studio</h1>
        <Button icon={<Upload size={16} />} onClick={() => nav("/studio/intake")}>
          Submit sources
        </Button>
      </div>

      <SectionHeader title="Needs work" />
      {kalams.isLoading ? (
        <Loading />
      ) : kalams.isError ? (
        <ErrorState message={(kalams.error as Error).message} />
      ) : kalamList.length ? (
        <div className="stack-sm">
          {kalamList.map((k) => (
            <Card key={k.slug}>
              <div className="u-heading u-clamp1">{k.title}</div>
              <div className="row wrap u-small">
                <Link to={`/studio/transcribe/${k.slug}`}>Transcribe</Link>
                <Link to={`/studio/translate/${k.slug}`}>Translate</Link>
                <Link to={`/studio/context/${k.slug}`}>Context</Link>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Empty title="Nothing queued" />
      )}

      <SectionHeader title="My submissions" action={<Link to="/studio/submissions">All</Link>} />
      {subs.isLoading ? (
        <Loading />
      ) : mySubs.length ? (
        <div className="stack-sm">
          {mySubs.map((s) => (
            <Card key={s.id}>
              <div className="between">
                <div className="u-heading u-clamp1 grow">{s.title}</div>
                {s.payload.kind ? <Pill>{s.payload.kind}</Pill> : null}
              </div>
              <Chip tone={STATUS_TONE[s.status] ?? "muted"}>{s.status}</Chip>
            </Card>
          ))}
        </div>
      ) : (
        <Empty title="No submissions yet" />
      )}
    </div>
  );
}
