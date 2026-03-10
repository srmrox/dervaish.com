import type { DeviceSyncState, OfflinePackage, Track } from "@dervaish/domain";

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

export function activeLyricLine(track: Track, positionMs: number): string | null {
  const lines = track.lyrics.lines;
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    if (positionMs >= lines[index].atMs) {
      return lines[index].text;
    }
  }
  return null;
}

