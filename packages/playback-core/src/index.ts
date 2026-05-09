import type { DeviceSyncState, LyricLanguage, LyricSegment, LyricSet, MediaAsset, OfflinePackage, Track } from "@dervaish/domain";

export interface OfflinePlan {
  packageId: string;
  shouldPrefetch: boolean;
  estimatedFootprintBytes: number;
  reason: string;
}

export function buildOfflinePlan(
  pkg: OfflinePackage,
  state: DeviceSyncState,
  recentTrackIds: string[]
): OfflinePlan {
  const shouldPrefetch = pkg.keepOffline || recentTrackIds.includes(pkg.targetId);
  const withinBudget = pkg.totalSizeBytes < state.storageBudgetBytes * 0.7;

  return {
    packageId: pkg.id,
    shouldPrefetch: shouldPrefetch && withinBudget,
    estimatedFootprintBytes: pkg.totalSizeBytes,
    reason: pkg.keepOffline
      ? "Pinned by user"
      : state.smartCacheEnabled && withinBudget
        ? "Eligible for smart cache"
        : "Deferred because of storage budget"
  };
}

export function activeLyricSegment(lyricSet: LyricSet, positionMs: number): LyricSegment | null {
  for (let index = lyricSet.segments.length - 1; index >= 0; index -= 1) {
    const segment = lyricSet.segments[index];
    if (positionMs >= segment.startMs && positionMs < segment.endMs) {
      return segment;
    }
  }
  return null;
}

export function activeLyricText(lyricSet: LyricSet, positionMs: number, languageId = lyricSet.languages[0]?.id ?? ""): string | null {
  const segment = activeLyricSegment(lyricSet, positionMs);
  if (!segment) return null;
  return segment.textByLanguageId[languageId] ?? null;
}

export function activeLyricLine(track: Track, positionMs: number): string | null {
  return activeLyricText(track.lyricSet, positionMs, track.lyricSet.languages[0]?.id);
}

export function selectRenderableLanguages(lyricSet: LyricSet, requestedLanguageIds: string[]) {
  const requested = requestedLanguageIds
    .map((id) => lyricSet.languages.find((language) => language.id === id))
    .filter((language): language is NonNullable<typeof language> => Boolean(language));

  return requested.slice(0, 3);
}

export function dirForLanguage(language?: Pick<LyricLanguage, "direction"> | null): "ltr" | "rtl" {
  return language?.direction === "rtl" ? "rtl" : "ltr";
}

export function textAlignForDirection(direction: "ltr" | "rtl"): "left" | "right" {
  return direction === "rtl" ? "right" : "left";
}

export function resolveMediaUrl(sourceUrl?: string): Pick<MediaAsset, "playbackUrl" | "urlSource"> {
  if (!sourceUrl) return { urlSource: "storage" };

  let parsed: URL;
  try {
    parsed = new URL(sourceUrl);
  } catch {
    return { urlSource: "external" };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { urlSource: "external" };
  }

  if (parsed.hostname === "raw.githubusercontent.com") {
    return { playbackUrl: parsed.toString(), urlSource: "github" };
  }

  if (parsed.hostname === "github.com") {
    const parts = parsed.pathname.split("/").filter(Boolean);
    const blobIndex = parts.indexOf("blob");
    if (parts.length > blobIndex + 2 && blobIndex === 2) {
      const [owner, repo] = parts;
      const branch = parts[blobIndex + 1];
      const path = parts.slice(blobIndex + 2).join("/");
      return {
        playbackUrl: `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`,
        urlSource: "github"
      };
    }
  }

  return { playbackUrl: parsed.toString(), urlSource: "external" };
}

export function withResolvedMediaUrl<T extends MediaAsset>(asset: T): T {
  const resolved = resolveMediaUrl(asset.sourceUrl);
  return {
    ...asset,
    playbackUrl: resolved.playbackUrl ?? asset.playbackUrl,
    urlSource: asset.sourceUrl ? resolved.urlSource : asset.urlSource ?? resolved.urlSource
  };
}
