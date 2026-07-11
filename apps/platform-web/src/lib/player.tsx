// Audio playback context backed by a single HTMLAudioElement. Resolves a
// rendition's first streaming/source variant URL from the playback manifest.
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";

import { resolveVariantUrl } from "./mirrors";
import type { Rendition } from "./types";

interface PlayerValue {
  current: Rendition | null;
  isPlaying: boolean;
  positionMs: number;
  durationMs: number;
  volume: number;
  error: string | null;
  play: (rendition: Rendition) => void;
  toggle: () => void;
  seek: (ms: number) => void;
  setVolume: (v: number) => void;
}

const Ctx = createContext<PlayerValue | null>(null);

function pickUrl(r: Rendition): string | null {
  const v = r.playback?.variants ?? [];
  const audio = v.find((x) => x.kind === "audio" && x.streaming) ?? v.find((x) => x.kind === "audio") ?? v[0];
  return audio ? resolveVariantUrl(audio) : null;
}

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [current, setCurrent] = useState<Rendition | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [positionMs, setPositionMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [volume, setVolumeState] = useState(1);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const el = new Audio();
    audioRef.current = el;
    const onTime = () => setPositionMs(el.currentTime * 1000);
    const onDur = () => setDurationMs((el.duration || 0) * 1000);
    const onEnd = () => setIsPlaying(false);
    const onError = () => {
      const codes: Record<number, string> = {
        1: "ABORTED",
        2: "NETWORK — file not reached (404 / proxy / CORS)",
        3: "DECODE — bad bytes or wrong content-type",
        4: "SRC_NOT_SUPPORTED — content-type not audio, or empty src",
      };
      const code = el.error?.code ?? 0;
      const msg = `[player] audio failed: ${codes[code] ?? "unknown"} — src="${el.currentSrc || el.src}"`;
      console.error(msg, el.error);
      setError(msg);
      setIsPlaying(false);
    };
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("loadedmetadata", onDur);
    el.addEventListener("ended", onEnd);
    el.addEventListener("error", onError);
    return () => {
      el.pause();
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("loadedmetadata", onDur);
      el.removeEventListener("ended", onEnd);
      el.removeEventListener("error", onError);
    };
  }, []);

  // keep the audio element's volume in sync with state
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  const value = useMemo<PlayerValue>(() => {
    const el = () => audioRef.current;
    return {
      current,
      isPlaying,
      positionMs,
      durationMs,
      volume,
      error,
      play(rendition) {
        const a = el();
        if (!a) return;
        setError(null);
        const url = pickUrl(rendition);
        if (!url) {
          setError("[player] no playable URL — no enabled mirror carries this rendition");
          return;
        }
        if (current?.slug !== rendition.slug) {
          setCurrent(rendition);
          a.src = url;
        }
        void a.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
      },
      toggle() {
        const a = el();
        if (!a || !current) return;
        if (a.paused) void a.play().then(() => setIsPlaying(true)).catch(() => {});
        else {
          a.pause();
          setIsPlaying(false);
        }
      },
      seek(ms) {
        const a = el();
        if (a) a.currentTime = ms / 1000;
      },
      setVolume(v) {
        const clamped = Math.max(0, Math.min(1, v));
        const a = el();
        if (a) a.volume = clamped;
        setVolumeState(clamped);
      },
    };
  }, [current, isPlaying, positionMs, durationMs, volume, error]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePlayer(): PlayerValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("usePlayer used outside PlayerProvider");
  return ctx;
}
