export type Visibility = "public" | "private" | "pending-review";
export type MediaKind = "audio" | "video" | "image";
export type AssetFormat = "flac" | "opus" | "aac" | "webm" | "mp4" | "mkv" | "mp3" | "wav" | "jpg" | "png";
export type SourceRatingKind = "editorial" | "community";
export type UserRole = "anonymous" | "listener" | "contributor" | "editor" | "admin";
export type SubmissionStatus = "draft" | "submitted" | "under_review" | "changes_requested" | "approved" | "rejected" | "published";
export type LyricDirection = "ltr" | "rtl";
export type LyricLanguageRole = "original" | "translation" | "transliteration";
export type VideoGenerationStatus = "queued" | "running" | "completed" | "failed" | "cancelled";
export type VideoGenerationSourceMode = "audio_visualizer" | "video_overlay";
export type VideoGenerationResolution = "720p" | "1080p" | "4k";

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
  originalFilename?: string;
  mimeType?: string;
  checksumSha256?: string;
  width?: number;
  height?: number;
  generatedByJobId?: string;
}

export interface LegacyLyricsLine {
  atMs: number;
  text: string;
}

export interface LegacyLyricsDocument {
  id: string;
  language: string;
  source: "embedded" | "sidecar" | "canonical";
  lines: LegacyLyricsLine[];
}

export interface LyricLanguage {
  id: string;
  code: string;
  name: string;
  direction: LyricDirection;
  role: LyricLanguageRole;
  isPublished: boolean;
}

export interface LyricSegment {
  id: string;
  startMs: number;
  endMs: number;
  textByLanguageId: Record<string, string>;
}

export interface LyricSet {
  id: string;
  source: "embedded" | "sidecar" | "canonical" | "submitted";
  languages: LyricLanguage[];
  segments: LyricSegment[];
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
  lyricSet: LyricSet;
  lyrics: LegacyLyricsDocument;
  mediaAssets: MediaAsset[];
  archiveRecordIds: string[];
  generatedVideoIds: string[];
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

export interface SubmissionMedia {
  id: string;
  submissionId: string;
  assetId: string;
  role: "source_audio" | "source_video" | "cover_image" | "supporting_file";
  uploadedAt: string;
}

export interface Submission {
  id: string;
  submitterId: string;
  title: string;
  voice?: string;
  writer?: string;
  notes?: string;
  sourceName?: string;
  visibility: Visibility;
  moderationStatus: SubmissionStatus;
  submittedAt?: string;
  createdAt: string;
  updatedAt: string;
  lyricSet: LyricSet;
  citations: Citation[];
  media: SubmissionMedia[];
  reviewNotes: string[];
  generatedVideoJobIds: string[];
}

export interface OfflinePackage {
  id: string;
  targetId: string;
  targetType: "track" | "release" | "playlist" | "archive-bundle" | "generated-video";
  version: number;
  mediaAssetIds: string[];
  archiveRecordIds: string[];
  lyricSetIds?: string[];
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

export interface VideoGenerationJob {
  id: string;
  submissionId?: string;
  trackId?: string;
  sourceMediaAssetId: string;
  sourceMode: VideoGenerationSourceMode;
  layoutId: string;
  resolution: VideoGenerationResolution;
  visibleLanguageIds: string[];
  title: string;
  voice?: string;
  writer?: string;
  imageAssetIds: string[];
  status: VideoGenerationStatus;
  progress: number;
  logs: string[];
  outputAssetIds: string[];
  previewAssetId?: string;
  failureReason?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface CatalogSnapshot {
  artists: Artist[];
  releases: Release[];
  tracks: Track[];
  videos: Video[];
  archiveRecords: ArchiveRecord[];
  submissions: Submission[];
  offlinePackages: OfflinePackage[];
  mediaAssets: MediaAsset[];
  videoGenerationJobs: VideoGenerationJob[];
}

export interface SearchResult {
  artists: Artist[];
  releases: Release[];
  tracks: Track[];
  videos: Video[];
  archiveRecords: ArchiveRecord[];
}

const lyricLanguages: LyricLanguage[] = [
  { id: "lang-sd", code: "sd", name: "Sindhi", direction: "rtl", role: "original", isPublished: true },
  { id: "lang-en", code: "en", name: "English", direction: "ltr", role: "translation", isPublished: true },
  { id: "lang-sd-latin", code: "sd-Latn", name: "Sindhi Transliteration", direction: "ltr", role: "transliteration", isPublished: true }
];

const lyricSegments: LyricSegment[] = [
  {
    id: "segment-river-001",
    startMs: 0,
    endMs: 8200,
    textByLanguageId: {
      "lang-sd": "The river remembers every name.",
      "lang-en": "The river remembers every name.",
      "lang-sd-latin": "The river remembers every name."
    }
  },
  {
    id: "segment-river-002",
    startMs: 8200,
    endMs: 16200,
    textByLanguageId: {
      "lang-sd": "Dust rises, then settles into song.",
      "lang-en": "Dust rises, then settles into song.",
      "lang-sd-latin": "Dust rises, then settles into song."
    }
  },
  {
    id: "segment-river-003",
    startMs: 16200,
    endMs: 24100,
    textByLanguageId: {
      "lang-sd": "A caravan of breath crosses the plain.",
      "lang-en": "A caravan of breath crosses the plain.",
      "lang-sd-latin": "A caravan of breath crosses the plain."
    }
  },
  {
    id: "segment-river-004",
    startMs: 24100,
    endMs: 258000,
    textByLanguageId: {
      "lang-sd": "Night keeps the meter of the drum.",
      "lang-en": "Night keeps the meter of the drum.",
      "lang-sd-latin": "Night keeps the meter of the drum."
    }
  }
];

const lyricSet: LyricSet = {
  id: "lyrics-sindh-river",
  source: "embedded",
  languages: lyricLanguages,
  segments: lyricSegments
};

export function toLegacyLyricsDocument(set: LyricSet, preferredLanguageId = set.languages[0]?.id ?? ""): LegacyLyricsDocument {
  const language = set.languages.find((item) => item.id === preferredLanguageId) ?? set.languages[0];
  return {
    id: set.id,
    language: language?.code ?? "und",
    source: set.source === "submitted" ? "canonical" : set.source,
    lines: set.segments.map((segment) => ({
      atMs: segment.startMs,
      text: segment.textByLanguageId[language?.id ?? preferredLanguageId] ?? ""
    }))
  };
}

const mediaAssets: MediaAsset[] = [
  {
    id: "asset-river-master",
    kind: "audio",
    format: "flac",
    durationMs: 258000,
    sizeBytes: 58200000,
    storageKey: "masters/audio/sindh-river.flac",
    isMaster: true,
    originalFilename: "sindh-river-master.wav",
    mimeType: "audio/flac",
    checksumSha256: "8d8d39fe4be47d5a34cf60ed7b555f9f"
  },
  {
    id: "asset-river-opus",
    kind: "audio",
    format: "opus",
    bitrateKbps: 128,
    durationMs: 258000,
    sizeBytes: 4200000,
    storageKey: "playback/audio/sindh-river.opus",
    isMaster: false,
    mimeType: "audio/ogg"
  },
  {
    id: "asset-video-master",
    kind: "video",
    format: "mkv",
    durationMs: 551000,
    sizeBytes: 784000000,
    storageKey: "masters/video/sindh-river-session.mkv",
    isMaster: true,
    mimeType: "video/x-matroska"
  },
  {
    id: "asset-video-stream",
    kind: "video",
    format: "mp4",
    durationMs: 551000,
    sizeBytes: 182000000,
    storageKey: "playback/video/sindh-river-session-1080.mp4",
    isMaster: false,
    mimeType: "video/mp4",
    width: 1920,
    height: 1080
  }
];

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
      lyricSet,
      lyrics: toLegacyLyricsDocument(lyricSet),
      availableOffline: true,
      archiveRecordIds: ["archive-oral-history"],
      generatedVideoIds: [],
      provenance: {
        sourceName: "Dervaish editorial ingest",
        importedAt: "2026-03-10T08:00:00.000Z",
        originalFilename: "sindh-river-master.wav",
        checksumSha256: "8d8d39fe4be47d5a34cf60ed7b555f9f",
        metadataSnapshotId: "snapshot-001"
      },
      mediaAssets: mediaAssets.filter((asset) => asset.id.startsWith("asset-river"))
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
      mediaAssets: mediaAssets.filter((asset) => asset.id.startsWith("asset-video"))
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
      voice: "Community contributor",
      writer: "Traditional",
      notes: "Needs source confirmation and lyric timing review.",
      sourceName: "Community cassette transfer",
      visibility: "private",
      moderationStatus: "under_review",
      submittedAt: "2026-03-10T10:00:00.000Z",
      createdAt: "2026-03-10T09:45:00.000Z",
      updatedAt: "2026-03-10T10:00:00.000Z",
      lyricSet: {
        id: "lyrics-submission-001",
        source: "submitted",
        languages: lyricLanguages.slice(0, 2),
        segments: lyricSegments.slice(0, 2)
      },
      citations: [],
      media: [],
      reviewNotes: ["Confirm cassette lineage before publishing."],
      generatedVideoJobIds: []
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
      lyricSetIds: ["lyrics-sindh-river"],
      totalSizeBytes: 5900000,
      keepOffline: true
    }
  ],
  mediaAssets,
  videoGenerationJobs: []
};

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
  const lyricIncludes = (set: LyricSet) =>
    set.languages.some((language) => includes(language.name) || includes(language.code)) ||
    set.segments.some((segment) => Object.values(segment.textByLanguageId).some(includes));

  return {
    artists: snapshot.artists.filter((artist) => includes(artist.name) || artist.genres.some(includes)),
    releases: snapshot.releases.filter((release) => includes(release.title)),
    tracks: snapshot.tracks.filter((track) => includes(track.title) || lyricIncludes(track.lyricSet)),
    videos: snapshot.videos.filter((video) => includes(video.title)),
    archiveRecords: snapshot.archiveRecords.filter((record) => includes(record.title) || includes(record.summary) || record.tags.some(includes))
  };
}
