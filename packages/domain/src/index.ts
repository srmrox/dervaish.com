export type Visibility = "public" | "private" | "pending-review";
export type MediaKind = "audio" | "video";
export type AssetFormat = "flac" | "opus" | "aac" | "webm" | "mp4" | "mkv";
export type SourceRatingKind = "editorial" | "community";
export type UserRole = "anonymous" | "listener" | "contributor" | "editor" | "admin";

export interface Provenance {
  sourceName: string;
  importedAt: string;
  originalFilename: string;
  checksumSha256: string;
  metadataSnapshotId: string;
}

export interface MediaAsset {
  id: string;
  kind: MediaKind;
  format: AssetFormat;
  bitrateKbps?: number;
  durationMs: number;
  sizeBytes: number;
  storageKey: string;
  isMaster: boolean;
}

export interface LyricsLine {
  atMs: number;
  text: string;
}

export interface LyricsDocument {
  id: string;
  language: string;
  source: "embedded" | "sidecar" | "canonical";
  lines: LyricsLine[];
}

export interface Citation {
  id: string;
  title: string;
  sourceType: "interview" | "book" | "field-recording" | "website" | "manuscript";
  author?: string;
  publishedAt?: string;
  url?: string;
  note: string;
}

export interface SourceRating {
  id: string;
  kind: SourceRatingKind;
  value: number;
  maxValue: number;
  rationale: string;
  contributor: string;
  createdAt: string;
}

export interface ArchiveRecord {
  id: string;
  title: string;
  summary: string;
  visibility: Visibility;
  tags: string[];
  citations: Citation[];
  ratings: SourceRating[];
  editorialNotes: string;
  contributorNotes: string[];
  relatedArtistIds: string[];
  relatedReleaseIds: string[];
  relatedTrackIds: string[];
  exportFormats: Array<"json" | "jsonld" | "csv">;
  revisionCount: number;
}

export interface Artist {
  id: string;
  name: string;
  origin: string;
  genres: string[];
  bio: string;
  archiveRecordIds: string[];
}

export interface Release {
  id: string;
  title: string;
  artistId: string;
  year: number;
  artworkUrl: string;
  trackIds: string[];
  type: "album" | "single" | "playlist";
}

export interface Track {
  id: string;
  title: string;
  artistId: string;
  releaseId: string;
  durationMs: number;
  visibility: Visibility;
  language: string;
  lyrics: LyricsDocument;
  mediaAssets: MediaAsset[];
  archiveRecordIds: string[];
  availableOffline: boolean;
  provenance: Provenance;
}

export interface Video {
  id: string;
  title: string;
  artistId: string;
  durationMs: number;
  visibility: Visibility;
  mediaAssets: MediaAsset[];
  archiveRecordIds: string[];
  availableOffline: boolean;
}

export interface Submission {
  id: string;
  submitterId: string;
  title: string;
  visibility: Visibility;
  moderationStatus: "draft" | "private" | "under-review" | "approved" | "rejected";
  submittedAt: string;
}

export interface OfflinePackage {
  id: string;
  targetId: string;
  targetType: "track" | "release" | "playlist" | "archive-bundle";
  version: number;
  mediaAssetIds: string[];
  archiveRecordIds: string[];
  totalSizeBytes: number;
  keepOffline: boolean;
}

export interface DeviceSyncState {
  deviceId: string;
  userId: string;
  smartCacheEnabled: boolean;
  mirrorModeEnabled: boolean;
  storageBudgetBytes: number;
  lastSyncedAt: string;
}

export interface CatalogSnapshot {
  artists: Artist[];
  releases: Release[];
  tracks: Track[];
  videos: Video[];
  archiveRecords: ArchiveRecord[];
  submissions: Submission[];
  offlinePackages: OfflinePackage[];
}

const lyrics: LyricsDocument = {
  id: "lyrics-sindh-river",
  language: "sd",
  source: "embedded",
  lines: [
    { atMs: 0, text: "The river remembers every name." },
    { atMs: 8200, text: "Dust rises, then settles into song." },
    { atMs: 16200, text: "A caravan of breath crosses the plain." },
    { atMs: 24100, text: "Night keeps the meter of the drum." }
  ]
};

export const demoCatalog: CatalogSnapshot = {
  artists: [
    {
      id: "artist-abida",
      name: "Abida Darya Ensemble",
      origin: "Sindh, Pakistan",
      genres: ["Sufi", "Folk", "Devotional"],
      bio: "A preservation-focused ensemble blending field-collected melodic traditions with contemporary arrangements.",
      archiveRecordIds: ["archive-oral-history"]
    }
  ],
  releases: [
    {
      id: "release-river",
      title: "Songs for the River Archive",
      artistId: "artist-abida",
      year: 2026,
      artworkUrl: "https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=1200&q=80",
      trackIds: ["track-sindh-river"],
      type: "album"
    }
  ],
  tracks: [
    {
      id: "track-sindh-river",
      title: "Sindh River at Dusk",
      artistId: "artist-abida",
      releaseId: "release-river",
      durationMs: 258000,
      visibility: "public",
      language: "sd",
      lyrics,
      availableOffline: true,
      archiveRecordIds: ["archive-oral-history"],
      provenance: {
        sourceName: "Dervaish editorial ingest",
        importedAt: "2026-03-10T08:00:00.000Z",
        originalFilename: "sindh-river-master.wav",
        checksumSha256: "8d8d39fe4be47d5a34cf60ed7b555f9f",
        metadataSnapshotId: "snapshot-001"
      },
      mediaAssets: [
        {
          id: "asset-river-master",
          kind: "audio",
          format: "flac",
          durationMs: 258000,
          sizeBytes: 58200000,
          storageKey: "masters/audio/sindh-river.flac",
          isMaster: true
        },
        {
          id: "asset-river-opus",
          kind: "audio",
          format: "opus",
          bitrateKbps: 128,
          durationMs: 258000,
          sizeBytes: 4200000,
          storageKey: "playback/audio/sindh-river.opus",
          isMaster: false
        }
      ]
    }
  ],
  videos: [
    {
      id: "video-river-session",
      title: "Sindh River Session Film",
      artistId: "artist-abida",
      durationMs: 551000,
      visibility: "public",
      archiveRecordIds: ["archive-oral-history"],
      availableOffline: true,
      mediaAssets: [
        {
          id: "asset-video-master",
          kind: "video",
          format: "mkv",
          durationMs: 551000,
          sizeBytes: 784000000,
          storageKey: "masters/video/sindh-river-session.mkv",
          isMaster: true
        },
        {
          id: "asset-video-stream",
          kind: "video",
          format: "mp4",
          durationMs: 551000,
          sizeBytes: 182000000,
          storageKey: "playback/video/sindh-river-session-1080.mp4",
          isMaster: false
        }
      ]
    }
  ],
  archiveRecords: [
    {
      id: "archive-oral-history",
      title: "Oral history and field notes for Sindh River repertoire",
      summary: "Interview extracts, field notes, and publication references documenting melody variants and lyric lineage.",
      visibility: "public",
      tags: ["fieldwork", "lyrics", "oral-history", "provenance"],
      citations: [
        {
          id: "citation-001",
          title: "Conversations on River Songs",
          sourceType: "interview",
          author: "N. Qureshi",
          publishedAt: "2024-09-12",
          url: "https://example.org/interviews/river-songs",
          note: "Primary interview with ensemble archivist."
        },
        {
          id: "citation-002",
          title: "Folk Meter in Lower Sindh",
          sourceType: "book",
          author: "R. H. Baloch",
          publishedAt: "2018-01-01",
          note: "Used to corroborate lyric cadence and regional variants."
        }
      ],
      ratings: [
        {
          id: "rating-editorial-001",
          kind: "editorial",
          value: 4.5,
          maxValue: 5,
          rationale: "Strong primary sourcing and clear provenance chain.",
          contributor: "editorial-board",
          createdAt: "2026-03-10T08:20:00.000Z"
        },
        {
          id: "rating-community-001",
          kind: "community",
          value: 4.2,
          maxValue: 5,
          rationale: "Consistent with oral variants known to local listeners.",
          contributor: "community-signal",
          createdAt: "2026-03-10T09:10:00.000Z"
        }
      ],
      editorialNotes: "Embedded lyric timing aligns with both field recording transcript and editorial normalization.",
      contributorNotes: [
        "Submitted recording lineage note references a 1990 wedding performance.",
        "Community suggests a second verse variant from Hyderabad."
      ],
      relatedArtistIds: ["artist-abida"],
      relatedReleaseIds: ["release-river"],
      relatedTrackIds: ["track-sindh-river"],
      exportFormats: ["json", "jsonld", "csv"],
      revisionCount: 3
    }
  ],
  submissions: [
    {
      id: "submission-001",
      submitterId: "user-guest-1",
      title: "Alternate field recording cassette transfer",
      visibility: "private",
      moderationStatus: "under-review",
      submittedAt: "2026-03-10T10:00:00.000Z"
    }
  ],
  offlinePackages: [
    {
      id: "offline-release-river",
      targetId: "release-river",
      targetType: "release",
      version: 1,
      mediaAssetIds: ["asset-river-opus"],
      archiveRecordIds: ["archive-oral-history"],
      totalSizeBytes: 5900000,
      keepOffline: true
    }
  ]
};

export interface SearchResult {
  artists: Artist[];
  releases: Release[];
  tracks: Track[];
  videos: Video[];
  archiveRecords: ArchiveRecord[];
}

export function searchCatalog(query: string, snapshot: CatalogSnapshot = demoCatalog): SearchResult {
  const q = query.trim().toLowerCase();
  if (!q) {
    return {
      artists: snapshot.artists,
      releases: snapshot.releases,
      tracks: snapshot.tracks,
      videos: snapshot.videos,
      archiveRecords: snapshot.archiveRecords
    };
  }

  const includes = (value: string) => value.toLowerCase().includes(q);

  return {
    artists: snapshot.artists.filter((artist) => includes(artist.name) || artist.genres.some(includes)),
    releases: snapshot.releases.filter((release) => includes(release.title)),
    tracks: snapshot.tracks.filter((track) => includes(track.title) || track.lyrics.lines.some((line) => includes(line.text))),
    videos: snapshot.videos.filter((video) => includes(video.title)),
    archiveRecords: snapshot.archiveRecords.filter((record) => includes(record.title) || includes(record.summary) || record.tags.some(includes))
  };
}

