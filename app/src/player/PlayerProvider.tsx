import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Platform } from "react-native";

import type { PlaybackManifest, Rendition } from "@/src/api/types";

/** Pick the best audio URL from a manifest: prefer a streaming audio variant. */
export function selectAudioUrl(manifest: PlaybackManifest): string | null {
  const audio = manifest.variants.filter((v) => v.kind === "audio");
  const pool = audio.length ? audio : manifest.variants;
  const streaming = pool.find((v) => v.streaming) ?? pool[0];
  return streaming?.url ?? null;
}

interface PlayerState {
  current: Rendition | null;
  isPlaying: boolean;
  positionMs: number;
  durationMs: number;
  play: (rendition: Rendition) => void;
  toggle: () => void;
  seek: (ms: number) => void;
}

const PlayerContext = createContext<PlayerState | null>(null);

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [current, setCurrent] = useState<Rendition | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [positionMs, setPositionMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);

  // Web-only HTMLAudioElement. Native playback (react-native-track-player) is
  // deferred with native builds; this provider no-ops off-web for now.
  useEffect(() => {
    if (Platform.OS !== "web" || typeof Audio === "undefined") return;
    const el = new Audio();
    audioRef.current = el;
    const onTime = () => setPositionMs(el.currentTime * 1000);
    const onMeta = () => setDurationMs((el.duration || 0) * 1000);
    const onEnd = () => setIsPlaying(false);
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("loadedmetadata", onMeta);
    el.addEventListener("ended", onEnd);
    return () => {
      el.pause();
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("loadedmetadata", onMeta);
      el.removeEventListener("ended", onEnd);
    };
  }, []);

  const play = useCallback((rendition: Rendition) => {
    const url = selectAudioUrl(rendition.playback);
    const el = audioRef.current;
    if (!url || !el) {
      setCurrent(rendition); // keep UI selection even if no playable URL
      return;
    }
    if (current?.slug !== rendition.slug) {
      el.src = url;
      setCurrent(rendition);
    }
    void el.play();
    setIsPlaying(true);
  }, [current?.slug]);

  const toggle = useCallback(() => {
    const el = audioRef.current;
    if (!el || !current) return;
    if (el.paused) {
      void el.play();
      setIsPlaying(true);
    } else {
      el.pause();
      setIsPlaying(false);
    }
  }, [current]);

  const seek = useCallback((ms: number) => {
    const el = audioRef.current;
    if (el) el.currentTime = ms / 1000;
  }, []);

  const value = useMemo(
    () => ({ current, isPlaying, positionMs, durationMs, play, toggle, seek }),
    [current, isPlaying, positionMs, durationMs, play, toggle, seek],
  );

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

export function usePlayer(): PlayerState {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be used within PlayerProvider");
  return ctx;
}
