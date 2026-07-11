import { useEffect, useState } from "react";

import { useAdminSubmissions, useApplySubmission, useReviewSubmission } from "../lib/hooks";
import { atLeast, useSession } from "../lib/session";
import { Button, Card, Chip, Empty, ErrorState, Loading, Pill } from "../ui";

const FILTERS: { label: string; value: string | undefined }[] = [
  { label: "Submitted", value: "submitted" },
  { label: "Approved", value: "approved" },
  { label: "Rejected", value: "rejected" },
  { label: "All", value: undefined },
];

function tone(status: string): "green" | "blue" | "warning" | "danger" | "muted" {
  if (status === "submitted") return "blue";
  if (["under_review", "in_review", "changes_requested", "pending"].includes(status)) return "warning";
  if (["approved", "published", "committed", "completed"].includes(status)) return "green";
  if (["rejected", "failed"].includes(status)) return "danger";
  return "muted";
}

export default function AdminReviewScreen() {
  const { role } = useSession();
  const [status, setStatus] = useState<string | undefined>("submitted");
  const [toast, setToast] = useState<string | null>(null);
  const review = useReviewSubmission();
  const apply = useApplySubmission();
  const subs = useAdminSubmissions(status, true);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2400);
    return () => clearTimeout(t);
  }, [toast]);

  if (!atLeast(role, "editor")) return <Empty title="Editor access required" />;

  const results = subs.data?.results ?? [];

  return (
    <div className="stack">
      <h1 className="u-display">Review</h1>
      <div className="row wrap">
        {FILTERS.map((f) => (
          <Button
            key={f.label}
            size="sm"
            variant={status === f.value ? "primary" : "secondary"}
            onClick={() => setStatus(f.value)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      {subs.isLoading ? (
        <Loading />
      ) : subs.isError ? (
        <ErrorState message={(subs.error as Error).message} />
      ) : results.length ? (
        <div className="stack-sm">
          {results.map((s) => (
            <Card key={s.id}>
              <div className="between">
                <div className="u-title u-clamp1 grow">{s.title}</div>
                {s.payload.kind ? <Pill>{s.payload.kind}</Pill> : null}
              </div>
              <div className="u-soft u-small">
                {s.author_name} · {s.created_at}
              </div>
              <Chip tone={tone(s.status)}>{s.status}</Chip>
              <pre className="u-tiny u-soft" style={{ overflow: "hidden", maxHeight: 120, margin: 0 }}>
                {JSON.stringify(s.payload).slice(0, 400)}
              </pre>
              <div className="row wrap" style={{ gap: "var(--s-2)" }}>
                <Button
                  size="sm"
                  disabled={review.isPending}
                  onClick={() => review.mutate({ id: s.id, status: "approved" })}
                >
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  disabled={review.isPending}
                  onClick={() => review.mutate({ id: s.id, status: "rejected" })}
                >
                  Reject
                </Button>
                <Button
                  size="sm"
                  variant="primary"
                  disabled={apply.isPending}
                  onClick={async () => {
                    const res = await apply.mutateAsync(s.id);
                    setToast(res.applied ? "Applied" : (res.reason ?? "Not applied"));
                  }}
                >
                  Apply
                </Button>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Empty title="Nothing to review" />
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
