// Device-side media-mirror preferences (the "manual" layer over the backend
// resolver). Works for anyone — no login. Persisted in localStorage so a visitor
// can enable/disable mirrors, point the local mirror at their own folder/host,
// and add custom mirrors, and the player honours it at play time.
import type { PlaybackVariant, Rendition } from "./types";

const K_OVERRIDES = "dervaish.mirror.overrides"; // { [slug]: boolean }
const K_CUSTOM = "dervaish.mirror.custom"; // CustomMirror[]
const K_LOCALBASE = "dervaish.mirror.localbase"; // string

export interface CustomMirror {
  slug: string;
  name: string;
  base_url: string;
  priority: number;
}

function read<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

export function getOverrides(): Record<string, boolean> {
  return read<Record<string, boolean>>(K_OVERRIDES, {});
}
export function setMirrorEnabled(slug: string, enabled: boolean): void {
  const o = getOverrides();
  o[slug] = enabled;
  write(K_OVERRIDES, o);
}
/** Enabled = explicit user choice, else the mirror's default_enabled. */
export function isMirrorEnabled(slug: string, defaultEnabled: boolean): boolean {
  const o = getOverrides();
  return slug in o ? o[slug] : defaultEnabled;
}

export function getCustomMirrors(): CustomMirror[] {
  return read<CustomMirror[]>(K_CUSTOM, []);
}
export function addCustomMirror(name: string, base_url: string): void {
  const list = getCustomMirrors();
  const slug = `custom-${Date.now()}`;
  list.push({ slug, name: name || base_url, base_url, priority: 5 });
  write(K_CUSTOM, list);
}
export function removeCustomMirror(slug: string): void {
  write(K_CUSTOM, getCustomMirrors().filter((m) => m.slug !== slug));
}

export function getLocalBase(): string {
  return read<string>(K_LOCALBASE, "");
}
export function setLocalBase(url: string): void {
  write(K_LOCALBASE, url.trim());
}

function join(base: string, key: string): string {
  return `${base.replace(/\/$/, "")}/${(key || "").replace(/^\//, "")}`;
}

/** Choose the best enabled URL for a variant, honouring user mirror prefs. */
export function resolveVariantUrl(variant: PlaybackVariant): string | null {
  const localBase = getLocalBase();
  const key = variant.storage_key || "";
  const candidates: { priority: number; url: string }[] = [];

  for (const m of variant.mirrors ?? []) {
    if (!isMirrorEnabled(m.mirror, m.default_enabled)) continue;
    const url = m.kind === "local" && localBase && key ? join(localBase, key) : m.url;
    candidates.push({ priority: m.priority, url });
  }
  // User-added custom mirrors apply to any variant with a storage key.
  if (key) {
    for (const c of getCustomMirrors()) {
      if (!isMirrorEnabled(c.slug, true)) continue;
      candidates.push({ priority: c.priority, url: join(c.base_url, key) });
    }
  }
  candidates.sort((a, b) => a.priority - b.priority);
  // Strict: only count URLs served by an *enabled* mirror that actually carries
  // the file (the backend resolver only lists mirrors that have it). No raw
  // fallback — so "unavailable on your mirrors" is honest.
  return candidates[0]?.url ?? null;
}

/** True if any variant is playable via the user's currently enabled mirrors. */
export function renditionHasMedia(r: Rendition): boolean {
  return (r.playback?.variants ?? []).some((v) => resolveVariantUrl(v) !== null);
}

/** Filter a list of renditions to those with available media. */
export function availableRenditions(list: Rendition[]): Rendition[] {
  return list.filter(renditionHasMedia);
}
