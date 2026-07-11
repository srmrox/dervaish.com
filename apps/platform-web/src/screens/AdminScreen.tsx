import { useNavigate } from "react-router-dom";

import { useAdminSubmissions } from "../lib/hooks";
import { atLeast, useSession } from "../lib/session";
import { Card, Empty, ErrorState, Loading } from "../ui";

export default function AdminScreen() {
  const nav = useNavigate();
  const { role } = useSession();
  const subs = useAdminSubmissions(undefined, true);

  if (!atLeast(role, "editor")) return <Empty title="Editor access required" />;
  if (subs.isLoading) return <Loading />;
  if (subs.isError) return <ErrorState message={(subs.error as Error).message} />;

  const count = subs.data?.results.length ?? 0;

  const tiles = [
    { label: "Review submissions", subtitle: `${count} to review`, to: "/admin/review" },
    { label: "Render jobs", subtitle: "Local worker queue", to: "/admin/renders" },
    { label: "Publish log", subtitle: "Committed content files", to: "/admin/publish" },
  ];

  return (
    <div className="stack">
      <h1 className="u-display">Admin</h1>
      <div className="grid-cards">
        {tiles.map((t) => (
          <Card key={t.to} onClick={() => nav(t.to)}>
            <div className="u-title">{t.label}</div>
            <div className="u-soft u-small">{t.subtitle}</div>
          </Card>
        ))}
      </div>
    </div>
  );
}
