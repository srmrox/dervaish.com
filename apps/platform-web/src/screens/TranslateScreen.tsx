import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { useCreateSubmission, useKalam } from "../lib/hooks";
import { dirFor, isRTL } from "../lib/format";
import { atLeast, useSession } from "../lib/session";
import { Button, Card, Empty, ErrorState, Field, Loading } from "../ui";

type Lang = "en" | "ur";

export default function TranslateScreen() {
  const { slug } = useParams();
  const nav = useNavigate();
  const { role, isSignedIn } = useSession();
  const { data, isLoading, isError, error } = useKalam(slug!);
  const create = useCreateSubmission();
  const [lang, setLang] = useState<Lang>("en");
  const [values, setValues] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<string | null>(null);

  if (!isSignedIn || !atLeast(role, "contributor")) {
    return (
      <div className="stack">
        <Empty title="Contributors only" hint="Sign in to translate." />
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

  async function submit() {
    const translations: Record<number, string> = {};
    for (const v of data.verses) {
      const t = values[`${v.order}:${lang}`];
      if (t) translations[v.order] = t;
    }
    await create.mutateAsync({
      title: `Translation (${lang}) — ${data.title}`,
      payload: { kind: "translation", kalam: slug, language: lang, translations },
    });
    setToast("Submitted");
    setTimeout(() => setToast(null), 2400);
    nav("/studio/submissions");
  }

  return (
    <div className="stack">
      <h1 className="u-display">Translate</h1>
      <div className="u-soft u-small">{data.title}</div>

      <div className="row">
        {(["en", "ur"] as Lang[]).map((l) => (
          <Button key={l} variant={lang === l ? "primary" : "secondary"} size="sm" onClick={() => setLang(l)}>
            {l.toUpperCase()}
          </Button>
        ))}
      </div>

      {data.verses.map((v) => {
        const key = `${v.order}:${lang}`;
        return (
          <Card key={v.order}>
            <div className={rtl ? "u-rtl u-body" : "u-body"} style={{ direction: dirFor(data.primary_language) }}>
              {v.text_native}
            </div>
            <Field
              value={values[key] ?? ""}
              onChange={(e) => setValues((s) => ({ ...s, [key]: e.target.value }))}
              placeholder={`Translation (${lang})`}
            />
          </Card>
        );
      })}

      <Button onClick={submit} disabled={create.isPending}>
        Submit
      </Button>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
