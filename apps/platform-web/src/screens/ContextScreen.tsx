import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { useCreateSubmission, useKalam } from "../lib/hooks";
import { atLeast, useSession } from "../lib/session";
import { Button, Empty, ErrorState, Field, Loading } from "../ui";

type Target = "kalam" | "verse" | "rendition";

export default function ContextScreen() {
  const { slug } = useParams();
  const nav = useNavigate();
  const { role, isSignedIn } = useSession();
  const { data, isLoading, isError, error } = useKalam(slug!);
  const create = useCreateSubmission();
  const [target, setTarget] = useState<Target>("kalam");
  const [verse, setVerse] = useState("");
  const [body, setBody] = useState("");
  const [citation, setCitation] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  if (!isSignedIn || !atLeast(role, "contributor")) {
    return (
      <div className="stack">
        <Empty title="Contributors only" hint="Sign in to add context." />
        <div className="center">
          <Link to="/auth">Sign in</Link>
        </div>
      </div>
    );
  }
  if (isLoading) return <Loading />;
  if (isError) return <ErrorState message={(error as Error).message} />;
  if (!data) return null;

  async function submit() {
    await create.mutateAsync({
      title: `Context — ${data.title}`,
      payload: {
        kind: "context",
        target: { kind: target, slug, ...(target === "verse" ? { verse: Number(verse) } : {}) },
        body_markdown: body,
        citation_url: citation,
      },
    });
    setToast("Submitted");
    setTimeout(() => setToast(null), 2400);
    nav("/studio/submissions");
  }

  return (
    <div className="stack">
      <h1 className="u-display">Context</h1>
      <div className="u-soft u-small">{data.title}</div>

      <div className="row wrap">
        {(["kalam", "verse", "rendition"] as Target[]).map((t) => (
          <Button key={t} variant={target === t ? "primary" : "secondary"} size="sm" onClick={() => setTarget(t)}>
            {t}
          </Button>
        ))}
      </div>

      {target === "verse" ? (
        <Field
          label="Verse number"
          type="number"
          value={verse}
          onChange={(e) => setVerse(e.target.value)}
          placeholder="1"
        />
      ) : null}

      <Field
        label="Context / meaning (Markdown)"
        multiline
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Background, meaning, references…"
      />
      <Field
        label="Citation URL"
        value={citation}
        onChange={(e) => setCitation(e.target.value)}
        placeholder="https://…"
      />

      <Button onClick={submit} disabled={create.isPending}>
        Submit
      </Button>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
