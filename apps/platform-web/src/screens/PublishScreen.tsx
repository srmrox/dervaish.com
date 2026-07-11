import { usePublishedFiles } from "../lib/hooks";
import { atLeast, useSession } from "../lib/session";
import { Card, Chip, Empty, ErrorState, Loading } from "../ui";

function tone(status: string): "green" | "blue" | "warning" | "danger" | "muted" {
  if (status === "submitted") return "blue";
  if (["under_review", "in_review", "changes_requested", "pending"].includes(status)) return "warning";
  if (["approved", "published", "committed", "completed"].includes(status)) return "green";
  if (["rejected", "failed"].includes(status)) return "danger";
  return "muted";
}

export default function PublishScreen() {
  const { role } = useSession();
  const files = usePublishedFiles(true);

  if (!atLeast(role, "editor")) return <Empty title="Editor access required" />;

  const results = files.data?.results ?? [];

  return (
    <div className="stack">
      <h1 className="u-display">Publish log</h1>
      <p className="u-soft u-small">DB→Markdown on approval; committed to the content repo.</p>

      {files.isLoading ? (
        <Loading />
      ) : files.isError ? (
        <ErrorState message={(files.error as Error).message} />
      ) : results.length ? (
        <div className="stack-sm">
          {results.map((f) => (
            <Card key={f.id}>
              <div className="between">
                <div className="u-clamp1 grow">{f.repo_path}</div>
                <Chip tone={tone(f.status)}>{f.status}</Chip>
              </div>
              <div className="row wrap u-tiny u-soft" style={{ gap: "var(--s-2)" }}>
                <span>{f.commit_sha || "—"}</span>
                <span>{f.published_at}</span>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Empty title="No published files yet" />
      )}
    </div>
  );
}
