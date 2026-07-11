import { useRenderJobs } from "../lib/hooks";
import { atLeast, useSession } from "../lib/session";
import { Card, Chip, Empty, ErrorState, Loading, Pill } from "../ui";

function tone(status: string): "green" | "blue" | "warning" | "danger" | "muted" {
  if (status === "submitted") return "blue";
  if (["under_review", "in_review", "changes_requested", "pending", "queued", "running"].includes(status))
    return "warning";
  if (["approved", "published", "committed", "completed"].includes(status)) return "green";
  if (["rejected", "failed"].includes(status)) return "danger";
  return "muted";
}

export default function RendersScreen() {
  const { role } = useSession();
  const jobs = useRenderJobs(true);

  if (!atLeast(role, "editor")) return <Empty title="Editor access required" />;

  const results = jobs.data?.results ?? [];

  return (
    <div className="stack">
      <h1 className="u-display">Render jobs</h1>
      <p className="u-soft u-small">
        Runs on the local i9/RTX 5090 worker; the queue drains while it&apos;s online.
      </p>

      {jobs.isLoading ? (
        <Loading />
      ) : jobs.isError ? (
        <ErrorState message={(jobs.error as Error).message} />
      ) : results.length ? (
        <div className="stack-sm">
          {results.map((j) => (
            <Card key={j.id}>
              <div className="between">
                <div className="u-title u-clamp1 grow">{j.title || j.rendition_slug}</div>
                <Chip tone={tone(j.status)}>{j.status}</Chip>
              </div>
              <div className="row wrap u-small u-soft" style={{ gap: "var(--s-2)" }}>
                <Pill>{j.source_mode}</Pill>
                <span>{j.resolution}</span>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Empty title="No render jobs" />
      )}
    </div>
  );
}
