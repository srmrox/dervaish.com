import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { useCreateRequest } from "../lib/hooks";
import { useSession } from "../lib/session";
import { Button, Empty, Field } from "../ui";

export default function RequestScreen() {
  const nav = useNavigate();
  const { isSignedIn } = useSession();
  const create = useCreateRequest();
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [authorHint, setAuthorHint] = useState("");
  const [reciterHint, setReciterHint] = useState("");

  if (!isSignedIn) {
    return (
      <div className="stack">
        <Empty title="Sign in to submit a request" />
        <div className="center">
          <Link to="/auth">Sign in</Link>
        </div>
      </div>
    );
  }

  async function submit() {
    await create.mutateAsync({
      title,
      details,
      author_hint: authorHint,
      reciter_hint: reciterHint,
    });
    nav("/requests");
  }

  return (
    <div className="stack">
      <h1 className="u-display">New request</h1>
      <Field label="Title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Kalam you'd like to find" />
      <Field
        label="Details"
        multiline
        value={details}
        onChange={(e) => setDetails(e.target.value)}
        placeholder="Any lyrics, context, or a recording you remember…"
      />
      <Field label="Author hint" value={authorHint} onChange={(e) => setAuthorHint(e.target.value)} placeholder="Poet / writer" />
      <Field label="Reciter hint" value={reciterHint} onChange={(e) => setReciterHint(e.target.value)} placeholder="Reciter / performer" />
      <Button onClick={submit} disabled={create.isPending || !title.trim()}>
        Submit request
      </Button>
    </div>
  );
}
