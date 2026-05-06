import type { DeviceSyncState, LyricSegment, LyricSet, OfflinePackage, Track } from "@dervaish/domain";

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
