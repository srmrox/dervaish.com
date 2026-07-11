// Playback context backed by a single persistent <video> element (audio-only
// renditions play through it with nothing visible). The element is created once
// and lives in an offscreen holder; screens can `mountVideo(container)` to move
// it into a visible panel — moving the same node with appendChild keeps playback
// uninterrupted (no reload). Native HTML5 <video> + playsInline = best web +
// mobile browser support for the progressive MP4 media.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import { resolveVariantUrl } from "./mirrors";
import type { Rendition } from "./types";

interface PlayerValue {
  current: Rendition | null;
  isPlaying: boolean;
  positionMs: number;
  durationMs: number;
  volume: number;
  isVideo: boolean;
  error: string | null;
  play: (rendition: Rendition) => void;
  toggle: () => void;
  seek: (ms: number) => void;
  setVolume: (v: number) => void;
  /** Move the shared <video> into `container` (or back to the holder when null). */
  mountVideo: (container: HTMLElement | null) => void;
}

const Ctx = createContext<PlayerValue | null>(null);

/** Prefer a playable video variant (it carries audio too); else audio. */
function pick(r: Rendition): { url: string; isVideo: boolean } | null {
  const variants = r.playback?.variants ?? [];
  for (const v of variants.filter((x) => x.kind === "video")) {
    const url = resolveVariantUrl(v);
    if (url) return { url, isVideo: true };
  }
  const audio =
    variants.find((x) => x.kind === "audio" && x.streaming) ?? variants.find((x) => x.kind === "audio") ?? variants[0];
  const url = audio ? resolveVariantUrl(audio) : null;
  return url ? { url, isVideo: false } : null;
}

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const holderRef = useRef<HTMLDivElement | null>(null);
  const [current, setCurrent] = useState<Rendition | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [positionMs, setPositionMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [volume, setVolumeState] = useState(1);
  const [isVideo, setIsVideo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const el = document.createElement("video");
    el.playsInline = true;
    el.setAttribute("playsinline", "");
    el.setAttribute("webkit-playsinline", "");
    el.preload = "metadata";
    Object.assign(el.style, { width: "100%", height: "100%", objectFit: "contain", background: "#000", display: "block" });
    videoRef.current = el;
    holderRef.current?.appendChild(el);

    const onTime = () => setPositionMs(el.currentTime * 1000);
    const onDur = () => setDurationMs((el.duration || 0) * 1000);
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnd = () => setIsPlaying(false);
    const onError = () => {
      const codes: Record<number, string> = {
        1: "ABORTED", 2: "NETWORK — file not reached (404 / proxy / CORS)",
        3: "DECODE — bad bytes or wrong content-type", 4: "SRC_NOT_SUPPORTED — unsupported media, or empty src",
      };
      const msg = `[player] media failed: ${codes[el.error?.code ?? 0] ?? "unknown"} — src="${el.currentSrc || el.src}"`;
      console.error(msg, el.error);
      setError(msg);
      setIsPlaying(false);
    };
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("loadedmetadata", onDur);
    el.addEventListener("durationchange", onDur);
    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);
    el.addEventListener("ended", onEnd);
    el.addEventListener("error", onError);
    return () => {
      el.pause();
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("loadedmetadata", onDur);
      el.removeEventListener("durationchange", onDur);
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
      el.removeEventListener("ended", onEnd);
      el.removeEventListener("error", onError);
      el.remove();
    };
  }, []);

  useEffect(() => {
    if (videoRef.current) videoRef.current.volume = volume;
  }, [volume]);

  const mountVideo = useCallback((container: HTMLElement | null) => {
    const el = videoRef.current;
    if (el) (container ?? holderRef.current)?.appendChild(el);
  }, []);

  const value = useMemo<PlayerValue>(() => {
    const el = () => videoRef.current;
    return {
      current, isPlaying, positionMs, durationMs, volume, isVideo, error,
      play(rendition) {
        const a = el();
        if (!a) return;
        setError(null);
        const picked = pick(rendition);
        if (!picked) {
          setError("[player] no playable URL — no enabled mirror carries this rendition");
          return;
        }
        if (current?.slug !== rendition.slug) {
          setCurrent(rendition);
          setIsVideo(picked.isVideo);
          a.src = picked.url;
        }
        void a.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
      },
      toggle() {
        const a = el();
        if (!a || !current) return;
        if (a.paused) void a.play().then(() => setIsPlaying(true)).catch(() => {});
        else a.pause();
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
      mountVideo,
    };
  }, [current, isPlaying, positionMs, durationMs, volume, isVideo, error, mountVideo]);

  return (
    <Ctx.Provider value={value}>
      <div ref={holderRef} aria-hidden style={{ position: "fixed", left: -9999, top: 0, width: 1, height: 1, overflow: "hidden", pointerEvents: "none" }} />
      {children}
    </Ctx.Provider>
  );
}

export function usePlayer(): PlayerValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("usePlayer used outside PlayerProvider");
  return ctx;
}
