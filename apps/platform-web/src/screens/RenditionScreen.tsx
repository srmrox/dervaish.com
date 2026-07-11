import { Pause, Play } from "lucide-react";
import { useState } from "react";
import { useParams } from "react-router-dom";

import { useRendition } from "../lib/hooks";
import { formatDuration } from "../lib/format";
import { resolveVariantUrl } from "../lib/mirrors";
import { usePlayer } from "../lib/player";
import { Button, Card, Chip, ErrorState, Loading } from "../ui";

const LAYERS = ["script", "transliteration", "translation", "meaning"] as const;
type Layer = (typeof LAYERS)[number];

export default function RenditionScreen() {
  const { slug } = useParams();
  const player = usePlayer();
  const [layers, setLayers] = useState<Layer[]>(["script", "translation"]);
  const { data, isLoading, isError, error } = useRendition(slug!);

  if (isLoading) return <Loading />;
  if (isError) return <ErrorState message={(error as Error).message} />;
  if (!data) return null;

  const isCurrent = player.current?.slug === data.slug;
  const playing = isCurrent && player.isPlaying;
  const reciter = data.credits.find((c) => c.role === "reciter")?.person_name;
  const videoVariant = data.playback?.variants?.find((v) => v.kind === "video");
  const videoUrl = videoVariant ? resolveVariantUrl(videoVariant) : null;

  const toggleLayer = (l: Layer) =>
    setLayers((prev) => (prev.includes(l) ? prev.filter((x) => x !== l) : [...prev, l]));

  return (
    <div className="stack">
      <div className="stack-sm">
        <h1 className="u-display">{data.title}</h1>
        {reciter ? <div className="u-soft u-small">Recited by {reciter}</div> : null}
        <div className="row wrap">
          <Chip tone="gold">{data.protection_level}</Chip>
        </div>
      </div>

      <div className="row">
        <Button
          variant="primary"
          icon={playing ? <Pause size={18} /> : <Play size={18} fill="currentColor" />}
          onClick={() => (isCurrent ? player.toggle() : player.play(data))}
        >
          {playing ? "Pause" : "Play"}
        </Button>
        <span className="u-soft u-small u-tabular">
          {formatDuration(isCurrent ? player.positionMs : 0)} /{" "}
          {formatDuration(isCurrent ? player.durationMs : data.duration_ms)}
        </span>
      </div>

      {videoUrl ? (
        <video
          controls
          playsInline
          src={videoUrl}
          style={{ width: "100%", borderRadius: "var(--r-panel)", background: "#000" }}
        />
      ) : null}

      <div className="row wrap">
        {LAYERS.map((l) => (
          <span key={l} onClick={() => toggleLayer(l)} style={{ cursor: "pointer" }}>
            <Chip tone={layers.includes(l) ? "green" : "muted"}>{l}</Chip>
          </span>
        ))}
      </div>

      <Card>
        <div className="u-small u-muted">Synced lyrics follow playback; verses live on the kalam.</div>
      </Card>
    </div>
  );
}
