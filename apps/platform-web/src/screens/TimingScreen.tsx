import { useState } from "react";
import { Pause, Play, Plus } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { useCreateSubmission, useRendition } from "../lib/hooks";
import { formatDuration } from "../lib/format";
import { usePlayer } from "../lib/player";
import { atLeast, useSession } from "../lib/session";
import { Button, Card, Empty, ErrorState, Loading } from "../ui";

interface Line {
  order: number;
  start_ms: number | null;
  end_ms: number | null;
}

const BARS = Array.from({ length: 48 }, (_, i) => 6 + Math.round(Math.abs(Math.sin(i * 1.3)) * 22));

export default function TimingScreen() {
  const { slug } = useParams();
  const nav = useNavigate();
  const { role, isSignedIn } = useSession();
  const { data, isLoading, isError, error } = useRendition(slug!);
  const player = usePlayer();
  const create = useCreateSubmission();
  const [lines, setLines] = useState<Line[]>(
    Array.from({ length: 6 }, (_, i) => ({ order: i + 1, start_ms: null, end_ms: null })),
  );
  const [toast, setToast] = useState<string | null>(null);

  if (!isSignedIn || !atLeast(role, "contributor")) {
    return (
      <div className="stack">
        <Empty title="Contributors only" hint="Sign in to sync timings." />
        <div className="center">
          <Link to="/auth">Sign in</Link>
        </div>
      </div>
    );
  }
  if (isLoading) return <Loading />;
  if (isError) return <ErrorState message={(error as Error).message} />;
  if (!data) return null;

  const isCurrent = player.current?.slug === data.slug;
  const playing = isCurrent && player.isPlaying;

  const stamp = (i: number, k: "start_ms" | "end_ms") =>
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, [k]: Math.round(player.positionMs) } : l)));

  async function submit() {
    await create.mutateAsync({
      title: `Timing — ${data.title}`,
      payload: { kind: "timing", rendition: slug, timings: lines },
    });
    setToast("Submitted");
    setTimeout(() => setToast(null), 2400);
    nav("/studio/submissions");
  }

  return (
    <div className="stack">
      <h1 className="u-display">Timing</h1>
      <div className="u-soft u-small">{data.title}</div>

      <div className="row">
        <Button
          icon={playing ? <Pause size={16} /> : <Play size={16} fill="currentColor" />}
          onClick={() => (isCurrent ? player.toggle() : player.play(data))}
        >
          {playing ? "Pause" : "Play"}
        </Button>
        <div className="u-tabular u-muted">{formatDuration(player.positionMs)}</div>
      </div>

      <div className="row" style={{ gap: 2, height: 32, alignItems: "flex-end" }}>
        {BARS.map((h, i) => (
          <div
            key={i}
            style={{
              width: 3,
              height: h,
              borderRadius: 2,
              background: isCurrent && i / BARS.length <= player.positionMs / (data.duration_ms || 1) ? "var(--green)" : "var(--surface-3)",
            }}
          />
        ))}
      </div>

      <p className="u-soft u-small">Collected redundantly; admin merges by median.</p>

      {lines.map((l, i) => (
        <Card key={i}>
          <div className="between">
            <div className="u-tiny u-soft">Line {l.order}</div>
            <div className="u-tabular u-small u-muted">
              {l.start_ms != null ? formatDuration(l.start_ms) : "–"} → {l.end_ms != null ? formatDuration(l.end_ms) : "–"}
            </div>
          </div>
          <div className="row wrap">
            <Button variant="ghost" size="sm" onClick={() => stamp(i, "start_ms")}>
              Tap in
            </Button>
            <Button variant="ghost" size="sm" onClick={() => stamp(i, "end_ms")}>
              Tap out
            </Button>
          </div>
        </Card>
      ))}

      <div className="row wrap">
        <Button
          variant="secondary"
          icon={<Plus size={16} />}
          onClick={() => setLines((ls) => [...ls, { order: ls.length + 1, start_ms: null, end_ms: null }])}
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
