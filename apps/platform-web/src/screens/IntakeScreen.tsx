import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

import { useCreateSubmission } from "../lib/hooks";
import { atLeast, useSession } from "../lib/session";
import { Button, Card, Empty, Field } from "../ui";

interface Row {
  url: string;
  title: string;
  reciter: string;
  writer: string;
}
const blank: Row = { url: "", title: "", reciter: "", writer: "" };

export default function IntakeScreen() {
  const nav = useNavigate();
  const { role, isSignedIn } = useSession();
  const create = useCreateSubmission();
  const [rows, setRows] = useState<Row[]>([{ ...blank }]);
  const [toast, setToast] = useState<string | null>(null);

  if (!isSignedIn || !atLeast(role, "contributor")) {
    return (
      <div className="stack">
        <Empty title="Contributors only" hint="Sign in to submit sources." />
        <div className="center">
          <Link to="/auth">Sign in</Link>
        </div>
      </div>
    );
  }

  const set = (i: number, k: keyof Row, v: string) =>
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, [k]: v } : row)));

  async function submit() {
    await create.mutateAsync({
      title: `Source batch (${rows.length})`,
      payload: { kind: "source", rows },
    });
    setToast("Submitted");
    setTimeout(() => setToast(null), 2400);
    nav("/studio/submissions");
  }

  return (
    <div className="stack">
      <h1 className="u-display">Submit sources</h1>
      <p className="u-soft u-small">
        URL auto-fetch is best-effort and added later; you can attach files after verification.
      </p>

      {rows.map((row, i) => (
        <Card key={i}>
          <Field label="URL" value={row.url} onChange={(e) => set(i, "url", e.target.value)} placeholder="https://…" />
          <Field label="Title" value={row.title} onChange={(e) => set(i, "title", e.target.value)} placeholder="Kalam title" />
          <Field label="Reciter" value={row.reciter} onChange={(e) => set(i, "reciter", e.target.value)} placeholder="Reciter" />
          <Field label="Writer" value={row.writer} onChange={(e) => set(i, "writer", e.target.value)} placeholder="Writer" />
          <Button
            variant="ghost"
            size="sm"
            icon={<Trash2 size={14} />}
            disabled={rows.length === 1}
            onClick={() => setRows((r) => r.filter((_, idx) => idx !== i))}
          >
            Remove
          </Button>
        </Card>
      ))}

      <div className="row wrap">
        <Button variant="secondary" icon={<Plus size={16} />} onClick={() => setRows((r) => [...r, { ...blank }])}>
          Add row
        </Button>
        <Button onClick={submit} disabled={create.isPending}>
          Submit batch
        </Button>
      </div>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
