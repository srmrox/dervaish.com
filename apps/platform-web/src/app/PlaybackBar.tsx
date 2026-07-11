import { Pause, Play, Volume1, Volume2, VolumeX } from "lucide-react";

import { usePlayer } from "../lib/player";
import { formatDuration } from "../lib/format";
import { IconButton } from "../ui";

export function PlaybackBar() {
  const { current, isPlaying, positionMs, durationMs, volume, toggle, seek, setVolume } = usePlayer();
  if (!current) return null;
  const reciter = current.credits.find((c) => c.role === "reciter")?.person_name;
  const total = durationMs || current.duration_ms;
  const pct = total ? (positionMs / total) * 100 : 0;
  const VolIcon = volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;

  return (
    <div
      style={{
        position: "sticky",
        bottom: 0,
        background: "var(--nav)",
        borderTop: "1px solid var(--line)",
        padding: "var(--s-2) var(--s-4)",
        display: "flex",
        alignItems: "center",
        gap: "var(--s-3)",
      }}
    >
      {/* top bar = seek. Full-width range pinned to the top edge; the filled
          track shows progress, drag/click/keyboard all seek. */}
      <input
        aria-label="Seek"
        type="range"
        min={0}
        max={total || 1}
        value={Math.min(positionMs, total || 0)}
        onChange={(e) => seek(Number(e.target.value))}
        className="seekbar"
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: -1,
          width: "100%",
          margin: 0,
          background: `linear-gradient(to right, var(--green) ${pct}%, var(--line) ${pct}%)`,
        }}
      />

      <IconButton label={isPlaying ? "Pause" : "Play"} onClick={toggle}>
        {isPlaying ? <Pause size={18} /> : <Play size={18} />}
      </IconButton>

      <div className="grow">
        <div className="u-small u-clamp1">{current.title || "Rendition"}</div>
        <div className="u-tiny u-soft u-clamp1">{reciter ?? "Unknown reciter"}</div>
      </div>

      <div className="u-tiny u-soft u-tabular">
        {formatDuration(positionMs)} / {formatDuration(total)}
      </div>

      {/* right bar = volume */}
      <div className="row" style={{ gap: "var(--s-2)" }}>
        <IconButton
          label={volume === 0 ? "Unmute" : "Mute"}
          onClick={() => setVolume(volume === 0 ? 1 : 0)}
        >
          <VolIcon size={18} />
        </IconButton>
        <input
          aria-label="Volume"
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={volume}
          onChange={(e) => setVolume(Number(e.target.value))}
          style={{ width: 96, accentColor: "var(--green)" }}
        />
      </div>
    </div>
  );
}
