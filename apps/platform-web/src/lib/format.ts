export function formatDuration(ms: number): string {
  const total = Math.round((ms ?? 0) / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = total % 60;
  const mm = h ? String(m).padStart(2, "0") : String(m);
  return `${h ? `${h}:` : ""}${mm}:${String(sec).padStart(2, "0")}`;
}

const RTL = new Set(["ur", "ar", "fa", "sd", "ps"]);
export function isRTL(code?: string | null): boolean {
  return !!code && RTL.has(code.toLowerCase());
}
export function dirFor(code?: string | null): "rtl" | "ltr" {
  return isRTL(code) ? "rtl" : "ltr";
}

/** First available value from a per-language map, preferring `en`. */
export function firstLang(map: Record<string, string> | undefined): string | undefined {
  if (!map) return undefined;
  return map.en ?? Object.values(map)[0];
}
