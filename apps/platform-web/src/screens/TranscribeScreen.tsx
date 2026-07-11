import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { useCreateSubmission, useKalam } from "../lib/hooks";
import { dirFor, isRTL } from "../lib/format";
import { atLeast, useSession } from "../lib/session";
import { Button, Card, Empty, ErrorState, Field, Loading } from "../ui";

interface Line {
  order: number;
  text_native: string;
  transliteration: string;
}

export default function TranscribeScreen() {
  const { slug } = useParams();
  const nav = useNavigate();
  const { role, isSignedIn } = useSession();
  const { data, isLoading, isError, error } = useKalam(slug!);
  const create = useCreateSubmission();
  const [verses, setVerses] = useState<Line[] | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  if (!isSignedIn || !atLeast(role, "contributor")) {
    return (
      <div className="stack">
        <Empty title="Contributors only" hint="Sign in to transcribe." />
        <div className="center">
          <Link to="/auth">Sign in</Link>
        </div>
      </div>
    );
  }
  if (isLoading) return <Loading />;
  if (isError) return <ErrorState message={(error as Error).message} />;
  if (!data) return null;

  const rtl = isRTL(data.primary_language);
  const lines: Line[] =
    verses ??
    (data.verses.length
      ? data.verses.map((v) => ({ order: v.order, text_native: v.text_native, transliteration: v.transliteration }))
      : [{ order: 1, text_native: "", transliteration: "" }]);

  const set = (i: number, k: "text_native" | "transliteration", v: string) =>
    setVerses(lines.map((l, idx) => (idx === i ? { ...l, [k]: v } : l)));

  async function submit() {
    await create.mutateAsync({
      title: `Transcription — ${data.title}`,
      payload: { kind: "transcription", kalam: slug, verses: lines },
    });
    setToast("Submitted");
    setTimeout(() => setToast(null), 2400);
    nav("/studio/submissions");
  }

  return (
    <div className="stack">
      <h1 className="u-display">Transcribe</h1>
      <div className="u-soft u-small">{data.title}</div>

      {lines.map((l, i) => (
        <Card key={i}>
          <div className="u-tiny u-soft">Line {l.order}</div>
          <Field
            rtl={rtl}
            value={l.text_native}
            onChange={(e) => set(i, "text_native", e.target.value)}
            placeholder="Native text"
            style={{ direction: dirFor(data.primary_language) }}
          />
          <Field
            value={l.transliteration}
            onChange={(e) => set(i, "transliteration", e.target.value)}
            placeholder="Transliteration"
          />
          <Button
            variant="ghost"
            size="sm"
            icon={<Trash2 size={14} />}
            disabled={lines.length === 1}
            onClick={() => setVerses(lines.filter((_, idx) => idx !== i))}
          >
            Remove
          </Button>
        </Card>
      ))}

      <div className="row wrap">
        <Button
          variant="secondary"
          icon={<Plus size={16} />}
          onClick={() => setVerses([...lines, { order: lines.length + 1, text_native: "", transliteration: "" }])}
        >
          Add line
        </Button>
        <Button onClick={submit} disabled={create.isPending}>
          Submit
        </Button>
      </div>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
