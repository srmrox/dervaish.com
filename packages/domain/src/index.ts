export type Visibility = "public" | "private" | "pending-review";
export type MediaKind = "audio" | "video" | "image";
export type AssetFormat = "flac" | "opus" | "aac" | "webm" | "mp4" | "mkv" | "mp3" | "wav" | "jpg" | "png";
export type MediaUrlSource = "storage" | "external" | "github";
export type SourceRatingKind = "editorial" | "community";
export type UserRole = "anonymous" | "listener" | "contributor" | "editor" | "admin";
export type SubmissionStatus = "draft" | "submitted" | "under_review" | "changes_requested" | "approved" | "rejected" | "published";
export type LyricDirection = "ltr" | "rtl";
export type LyricLanguageRole = "original" | "translation" | "transliteration";
export type VideoGenerationStatus = "queued" | "running" | "completed" | "failed" | "cancelled";
export type VideoGenerationSourceMode = "audio_visualizer" | "video_overlay";
export type VideoGenerationResolution = "720p" | "1080p" | "4k";
export type PersonRole = "reciter" | "writer" | "both";
export type TrackRequestStatus = "open" | "planned" | "fulfilled" | "rejected";
export type SubmissionVerificationField = "writer" | "reciter" | "lyrics" | "source" | "overall";
export type SubmissionVerificationVote = "verify" | "dispute";
export type CorrectionField = "lyrics" | "writer" | "reciter" | "source" | "metadata" | "media";
export type MediaLibraryKind = "github" | "external" | "storage";

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
  sourceUrl?: string;
  playbackUrl?: string;
  urlSource?: MediaUrlSource;
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
  relatedCollectionIds: string[];
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

export interface Person {
  id: string;
  name: string;
  role: PersonRole;
  bio?: string;
  origin?: string;
  archiveRecordIds: string[];
}

export interface Collection {
  id: string;
  title: string;
  ownerUserId: string;
  createdByRole: UserRole;
  visibility: Extract<Visibility, "public" | "private">;
  isCurated: boolean;
  artworkUrl: string;
  year?: number;
  trackIds: string[];
  shareToken?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Track {
  id: string;
  title: string;
  artistId: string;
  collectionId: string;
  reciterIds: string[];
  writerIds: string[];
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
  upvoteCount?: number;
  upvotedByCurrentUser?: boolean;
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
  correctionForTrackId?: string;
  correctionFields: CorrectionField[];
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
  verificationSummary?: SubmissionVerificationSummary;
  currentUserVerifications?: Partial<Record<SubmissionVerificationField, SubmissionVerification>>;
}

export interface UserLyricPreference {
  userId: string;
  trackId: string;
  visibleLanguageIds: string[];
  updatedAt: string;
}

export interface MediaLibrary {
  id: string;
  title: string;
  kind: MediaLibraryKind;
  baseUrl?: string;
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MediaMirror {
  id: string;
  libraryId: string;
  trackId: string;
  kind: MediaKind;
  format?: AssetFormat;
  sourceUrl: string;
  playbackUrl?: string;
  urlSource?: MediaUrlSource;
  checksumSha256?: string;
  isAvailable: boolean;
  lastCheckedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OfflinePackage {
  id: string;
  targetId: string;
  targetType: "track" | "collection" | "queue" | "archive-bundle" | "generated-video";
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

export interface UserQueueItem {
  id: string;
  queueId: string;
  trackId: string;
  position: number;
  addedAt: string;
}

export interface UserQueue {
  id: string;
  ownerUserId: string;
  title: string;
  items: UserQueueItem[];
  createdAt: string;
  updatedAt: string;
}

export interface TrackRequest {
  id: string;
  title: string;
  trackId?: string;
  reciterName?: string;
  writerName?: string;
  notes?: string;
  requesterUserId: string;
  status: TrackRequestStatus;
  upvoteCount: number;
  upvotedByCurrentUser: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TrackVote {
  trackId: string;
  userId: string;
  createdAt: string;
}

export interface TrackRequestVote {
  requestId: string;
  userId: string;
  createdAt: string;
}

export interface SubmissionVerification {
  id: string;
  submissionId: string;
  verifierUserId: string;
  field: SubmissionVerificationField;
  vote: SubmissionVerificationVote;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

export type SubmissionVerificationSummary = Record<SubmissionVerificationField, {
  verify: number;
  dispute: number;
}>;

export interface CatalogSnapshot {
  artists: Artist[];
  people: Person[];
  collections: Collection[];
  tracks: Track[];
  videos: Video[];
  archiveRecords: ArchiveRecord[];
  submissions: Submission[];
  offlinePackages: OfflinePackage[];
  mediaAssets: MediaAsset[];
  videoGenerationJobs: VideoGenerationJob[];
  trackRequests: TrackRequest[];
  mediaLibraries: MediaLibrary[];
  mediaMirrors: MediaMirror[];
}

export interface SearchResult {
  artists: Artist[];
  people: Person[];
  collections: Collection[];
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

const importedLyricLanguages: LyricLanguage[] = [
  { id: "lang-import-fa", code: "fa", name: "Persian", direction: "rtl", role: "original", isPublished: true },
  { id: "lang-import-en", code: "en", name: "English", direction: "ltr", role: "translation", isPublished: true },
  { id: "lang-import-ur", code: "ur", name: "Urdu", direction: "rtl", role: "translation", isPublished: true },
  { id: "lang-import-fa-latin", code: "fa-Latn", name: "Persian Transliteration", direction: "ltr", role: "transliteration", isPublished: true }
];

const importedLyricSegments: LyricSegment[] = [
  {
    id: "segment-import-001",
    startMs: 0,
    endMs: 30000,
    textByLanguageId: {
      "lang-import-fa": "تنم…",
      "lang-import-en": "My body…",
      "lang-import-ur": "میرا جسم…",
      "lang-import-fa-latin": "Tanam…"
    }
  },
  {
    id: "segment-import-002",
    startMs: 30000,
    endMs: 75000,
    textByLanguageId: {
      "lang-import-fa": "تنم فرسودہ جاں پارہ…",
      "lang-import-en": "My body is dissolving…",
      "lang-import-ur": "میرا جسم ناکارہ اور ٹکٹرے ٹکڑے ہو گیا ہے…",
      "lang-import-fa-latin": "Tanam farsooda, jaan para…"
    }
  },
  {
    id: "segment-import-003",
    startMs: 75000,
    endMs: 100000,
    textByLanguageId: {
      "lang-import-fa": "تنم فرسودہ جاں پارہ\nز ہجراں، یا رسول اللہ (صلی اللہ علیہ وسلم)",
      "lang-import-en": "My body is dissolving in your separation,\nAnd my soul is breaking into pieces, oh Messenger of Allah.",
      "lang-import-ur": "میرا جسم ناکارہ اور ٹکٹرے ٹکڑے ہو گیا ہے\nآپ کی جدائی میں یا رسول اللہ ﷺ",
      "lang-import-fa-latin": "Tanam farsooda, jaan para,\nZe hijran, ya Rasulallah."
    }
  },
  {
    id: "segment-import-004",
    startMs: 100000,
    endMs: 120000,
    textByLanguageId: {
      "lang-import-fa": "دلم  پژمردہ آوارہ\nز عصیاں، یا رسول اللہ (صلی اللہ علیہ وسلم)",
      "lang-import-en": "Due to my sins, my heart is weak,\nand becoming enticed, oh Messenger of Allah.",
      "lang-import-ur": "میرا دل بھٹک رہا ہے اور دل گناہوں کے بوجھ سے\nمرجھا چکا ہے یا رسول اللہ ﷺ",
      "lang-import-fa-latin": "Dillam paz murda aawara,\nZe isyaan, ya Rasulallah."
    }
  },
  {
    id: "segment-import-005",
    startMs: 120000,
    endMs: 140000,
    textByLanguageId: {
      "lang-import-fa": "تنم فرسودہ جاں پارہ\nز ہجراں، یا رسول اللہ (صلی اللہ علیہ وسلم)",
      "lang-import-en": "My body is dissolving in your separation,\nAnd my soul is breaking into pieces, oh Messenger of Allah.",
      "lang-import-ur": "میرا جسم ناکارہ اور ٹکٹرے ٹکڑے ہو گیا ہے\nآپ کی جدائی میں یا رسول اللہ ﷺ",
      "lang-import-fa-latin": "Tanam farsooda, jaan para,\nZe hijran, ya Rasulallah."
    }
  },
  {
    id: "segment-import-006",
    startMs: 140000,
    endMs: 220000,
    textByLanguageId: {
      "lang-import-fa": "چوں سوۓ من گذر آری، من مسکین ز ناداری\nفداۓ نقش نعلینت کنم جاں، یا رسول اللہ  (صلی اللہ علیہ وسلم)",
      "lang-import-en": "When you pass by me, then even in my immense poverty, ecstatically,\nI must sacrifice my soul on the impression of your Blessed Sandal, oh Messenger of Allah.",
      "lang-import-ur": "کبھی خواب میں ہی اپنا جلوہ دکھا دیجیے اس عاجز،غریب و مسکین سائل کو\nتو میں پھر آپ کے نعلینِ مبارک کے نقش پر فدا ہو جاوں گا یا رسول اللہ ﷺ",
      "lang-import-fa-latin": "Choon soo’e mun guzar aari, manne miskeen zanaa daari,\nFida-e-Naqsh-e-Nalainat, kunam ja, ya Rasulallah."
    }
  },
  {
    id: "segment-import-007",
    startMs: 220000,
    endMs: 240000,
    textByLanguageId: {
      "lang-import-fa": "تنم فرسودہ جاں پارہ\nز ہجراں، یا رسول اللہ (صلی اللہ علیہ وسلم)",
      "lang-import-en": "My body is dissolving in your separation,\nAnd my soul is breaking into pieces, oh Messenger of Allah.",
      "lang-import-ur": "میرا جسم ناکارہ اور ٹکٹرے ٹکڑے ہو گیا ہے\nآپ کی جدائی میں یا رسول اللہ ﷺ",
      "lang-import-fa-latin": "Tanam farsooda, jaan para,\nZe hijran, ya Rasulallah."
    }
  },
  {
    id: "segment-import-008",
    startMs: 240000,
    endMs: 290000,
    textByLanguageId: {
      "lang-import-fa": "زکردہ خیش حیرانم، سیاہ شد روز عصیانم\nپشیمانم، پشیمانم، پشیمانم،  یا رسول اللہ  (صلی اللہ علیہ وسلم)",
      "lang-import-en": "I am worried due to my misdeeds, and I feel that my sins have blackened my heart,\nI am in distress, I am in distress. I am in distress, oh Messenger of Allah.",
      "lang-import-ur": "میں نے جو کچھ کیا ہے بہت حیران ہوں، روزِ حساب میرا اعمال نامہ گناہوں سے سیاہ ہو گا\nمیں انتہائی پشیمان اور سخت شرمندہ ہوں، یا رسول اللہ ﷺ",
      "lang-import-fa-latin": "Ze kharda khaish hairaanam, siyaa shud roze isyaanam,\nPashemaanam, pashemaanam. Pashemaanam, ya Rasulallah."
    }
  },
  {
    id: "segment-import-009",
    startMs: 290000,
    endMs: 345000,
    textByLanguageId: {
      "lang-import-fa": "چوں بازوۓ شفاعت را کشا بر گناہگاراں\nمکن محروم جامی را در آں، یا رسول اللہ  (صلی اللہ علیہ وسلم)",
      "lang-import-en": "When you raise your hands to intercede for the sinners,\nThen do not deprive Jami of your exalted intercession, oh Messenger of Allah.",
      "lang-import-ur": "جب روزِ قیامت آپ اپنی شفاعت کا بازو لمبا کر کے گناہ گاروں کے سر پر پھیلا دیں گے\nاس روز اس عاجز جامی کو بھول نہ جایئے گا، اس جان جوکھوں کی نازک گھڑی میں یا رسول اللہﷺ",
      "lang-import-fa-latin": "Choon baazoo’e shafaa’at raa, khushaa’i bar gunaagara,\nMakun mahruume Jaami raa, daraa aan, ya Rasulallah."
    }
  },
  {
    id: "segment-import-010",
    startMs: 345000,
    endMs: 366000,
    textByLanguageId: {
      "lang-import-fa": "تنم فرسودہ جاں پارہ\nز ہجراں، یا رسول اللہ (صلی اللہ علیہ وسلم)",
      "lang-import-en": "My body is dissolving in your separation,\nAnd my soul is breaking into pieces, oh Messenger of Allah.",
      "lang-import-ur": "میرا جسم ناکارہ اور ٹکٹرے ٹکڑے ہو گیا ہے\nآپ کی جدائی میں یا رسول اللہ ﷺ",
      "lang-import-fa-latin": "Tanam farsooda, jaan para,\nZe hijran, ya Rasulallah."
    }
  }
];

function importedLyricSet(id: string, segmentPrefix: string): LyricSet {
  return {
    id,
    source: "sidecar",
    languages: importedLyricLanguages,
    segments: importedLyricSegments.map((segment) => ({
      ...segment,
      id: segment.id.replace("segment-import", segmentPrefix)
    }))
  };
}

const tanamLyricSet = importedLyricSet("lyrics-tanam-farsooda", "segment-tanam");
const yaNabiLyricSet = importedLyricSet("lyrics-ya-nabi-salam", "segment-ya-nabi");

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
    sourceUrl: "https://github.com/srmrox/dervaish-media/blob/main/audio/sindh-river.flac",
    playbackUrl: "https://raw.githubusercontent.com/srmrox/dervaish-media/main/audio/sindh-river.flac",
    urlSource: "github",
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
    sourceUrl: "https://github.com/srmrox/dervaish-media/blob/main/audio/sindh-river.opus",
    playbackUrl: "https://raw.githubusercontent.com/srmrox/dervaish-media/main/audio/sindh-river.opus",
    urlSource: "github",
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
    sourceUrl: "https://github.com/srmrox/dervaish-media/blob/main/video/sindh-river-session.mkv",
    playbackUrl: "https://raw.githubusercontent.com/srmrox/dervaish-media/main/video/sindh-river-session.mkv",
    urlSource: "github",
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
    sourceUrl: "https://raw.githubusercontent.com/srmrox/dervaish-media/main/video/sindh-river-session-1080.mp4",
    playbackUrl: "https://raw.githubusercontent.com/srmrox/dervaish-media/main/video/sindh-river-session-1080.mp4",
    urlSource: "github",
    isMaster: false,
    mimeType: "video/mp4",
    width: 1920,
    height: 1080
  },
  {
    id: "asset-tanam-audio",
    kind: "audio",
    format: "mp3",
    durationMs: 366000,
    sizeBytes: 5940000,
    storageKey: "imported-media/tanam-farsooda-ja-para/audio.mp3",
    playbackUrl: "/imported-media/tanam-farsooda-ja-para/audio.mp3",
    urlSource: "storage",
    isMaster: true,
    originalFilename: "audio.mp3",
    mimeType: "audio/mpeg"
  },
  {
    id: "asset-tanam-image",
    kind: "image",
    format: "jpg",
    durationMs: 0,
    sizeBytes: 20480,
    storageKey: "imported-media/tanam-farsooda-ja-para/image.jpg",
    playbackUrl: "/imported-media/tanam-farsooda-ja-para/image.jpg",
    urlSource: "storage",
    isMaster: true,
    originalFilename: "image.jpg",
    mimeType: "image/jpeg",
    width: 256,
    height: 326
  },
  {
    id: "asset-ya-nabi-audio",
    kind: "audio",
    format: "mp3",
    durationMs: 366000,
    sizeBytes: 5940000,
    storageKey: "imported-media/ya-nabi-salam-alayka/audio.mp3",
    playbackUrl: "/imported-media/ya-nabi-salam-alayka/audio.mp3",
    urlSource: "storage",
    isMaster: true,
    originalFilename: "audio.mp3",
    mimeType: "audio/mpeg"
  },
  {
    id: "asset-ya-nabi-image",
    kind: "image",
    format: "jpg",
    durationMs: 0,
    sizeBytes: 20480,
    storageKey: "imported-media/ya-nabi-salam-alayka/image.jpg",
    playbackUrl: "/imported-media/ya-nabi-salam-alayka/image.jpg",
    urlSource: "storage",
    isMaster: true,
    originalFilename: "image.jpg",
    mimeType: "image/jpeg",
    width: 256,
    height: 326
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
  people: [
    {
      id: "person-zulfikar",
      name: "Zulfikar Ali",
      role: "reciter",
      origin: "Sindh, Pakistan",
      bio: "A devotional reciter represented in the preserved listening catalog.",
      archiveRecordIds: ["archive-oral-history"]
    },
    {
      id: "person-traditional",
      name: "Traditional",
      role: "writer",
      bio: "Traditional authorship used where the original writer is unknown or collectively transmitted.",
      archiveRecordIds: ["archive-oral-history"]
    },
    {
      id: "person-jami",
      name: "Maulana Abdur Rahman Jami",
      role: "writer",
      origin: "Herat",
      bio: "Classical poet and writer associated with devotional verse traditions.",
      archiveRecordIds: ["archive-oral-history"]
    }
  ],
  collections: [
    {
      id: "collection-river",
      title: "Songs for the River Archive",
      ownerUserId: "admin-web",
      createdByRole: "admin",
      visibility: "public",
      isCurated: true,
      year: 2026,
      artworkUrl: "https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=1200&q=80",
      trackIds: ["track-sindh-river"],
      createdAt: "2026-03-10T08:00:00.000Z",
      updatedAt: "2026-03-10T08:00:00.000Z"
    },
    {
      id: "collection-imported-lyrics-video",
      title: "Imported Lyrics Video Collection",
      ownerUserId: "admin-web",
      createdByRole: "admin",
      visibility: "public",
      isCurated: true,
      year: 2026,
      artworkUrl: "/imported-media/tanam-farsooda-ja-para/image.jpg",
      trackIds: ["track-tanam-farsooda", "track-ya-nabi-salam"],
      createdAt: "2026-05-09T00:00:00.000Z",
      updatedAt: "2026-05-09T00:00:00.000Z"
    }
  ],
  tracks: [
    {
      id: "track-sindh-river",
      title: "Sindh River at Dusk",
      artistId: "artist-abida",
      collectionId: "collection-river",
      reciterIds: ["person-zulfikar"],
      writerIds: ["person-traditional", "person-jami"],
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
    },
    {
      id: "track-tanam-farsooda",
      title: "Tanam Farsooda Jaan Para",
      artistId: "artist-abida",
      collectionId: "collection-imported-lyrics-video",
      reciterIds: ["person-zulfikar"],
      writerIds: ["person-jami"],
      durationMs: 366000,
      visibility: "public",
      language: "fa",
      lyricSet: tanamLyricSet,
      lyrics: toLegacyLyricsDocument(tanamLyricSet),
      availableOffline: true,
      archiveRecordIds: ["archive-imported-lyrics-video"],
      generatedVideoIds: [],
      provenance: {
        sourceName: "OneDrive Lyrics Video import",
        importedAt: "2026-05-09T00:00:00.000Z",
        originalFilename: "Tanam Farsooda Ja Para/audio.mp3",
        checksumSha256: "onedrive-import-tanam-farsooda",
        metadataSnapshotId: "snapshot-imported-lyrics-video"
      },
      mediaAssets: mediaAssets.filter((asset) => asset.id.startsWith("asset-tanam"))
    },
    {
      id: "track-ya-nabi-salam",
      title: "Ya Nabi Salam Alayka",
      artistId: "artist-abida",
      collectionId: "collection-imported-lyrics-video",
      reciterIds: ["person-zulfikar"],
      writerIds: ["person-jami"],
      durationMs: 366000,
      visibility: "public",
      language: "fa",
      lyricSet: yaNabiLyricSet,
      lyrics: toLegacyLyricsDocument(yaNabiLyricSet),
      availableOffline: true,
      archiveRecordIds: ["archive-imported-lyrics-video"],
      generatedVideoIds: [],
      provenance: {
        sourceName: "OneDrive Lyrics Video import",
        importedAt: "2026-05-09T00:00:00.000Z",
        originalFilename: "Ya Nabi Salam Alayka/audio.mp3",
        checksumSha256: "onedrive-import-ya-nabi-salam",
        metadataSnapshotId: "snapshot-imported-lyrics-video"
      },
      mediaAssets: mediaAssets.filter((asset) => asset.id.startsWith("asset-ya-nabi"))
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
      relatedCollectionIds: ["collection-river"],
      relatedTrackIds: ["track-sindh-river"],
      exportFormats: ["json", "jsonld", "csv"],
      revisionCount: 3
    },
    {
      id: "archive-imported-lyrics-video",
      title: "Imported OneDrive lyric video source files",
      summary: "Audio, cover images, and timed multilingual lyric files imported from the Lyrics Video/new folder.",
      visibility: "public",
      tags: ["import", "lyrics", "audio", "onedrive"],
      citations: [
        {
          id: "citation-imported-lyrics-video",
          title: "Lyrics Video/new OneDrive folder",
          sourceType: "field-recording",
          author: "Dervaish archive import",
          publishedAt: "2026-05-09",
          note: "Local import from C:\\Users\\Msi\\OneDrive - Hina Shahrukh Group Ltd\\Dervaish\\Lyrics Video\\new."
        }
      ],
      ratings: [],
      editorialNotes: "The Ya Nabi Salam Alayka folder carried Tanam Farsooda lyric metadata; folder name was preserved as the track title for review.",
      contributorNotes: ["Imported media includes audio.mp3, image.jpg, and sidecar lyric timing files."],
      relatedArtistIds: ["artist-abida"],
      relatedCollectionIds: ["collection-imported-lyrics-video"],
      relatedTrackIds: ["track-tanam-farsooda", "track-ya-nabi-salam"],
      exportFormats: ["json", "csv"],
      revisionCount: 1
    }
  ],
  submissions: [
    {
      id: "submission-001",
      submitterId: "user-guest-1",
      correctionFields: [],
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
      id: "offline-collection-river",
      targetId: "collection-river",
      targetType: "collection",
      version: 1,
      mediaAssetIds: ["asset-river-opus"],
      archiveRecordIds: ["archive-oral-history"],
      lyricSetIds: ["lyrics-sindh-river"],
      totalSizeBytes: 5900000,
      keepOffline: true
    }
  ],
  mediaAssets,
  videoGenerationJobs: [],
  trackRequests: [
    {
      id: "track-request-kafi",
      title: "Kafi by Shah Abdul Latif",
      reciterName: "Abida Darya Ensemble",
      writerName: "Shah Abdul Latif Bhittai",
      notes: "Community members have asked for a clean archival recording with synced lyrics.",
      requesterUserId: "contributor-web",
      status: "open",
      upvoteCount: 0,
      upvotedByCurrentUser: false,
      createdAt: "2026-03-10T11:00:00.000Z",
      updatedAt: "2026-03-10T11:00:00.000Z"
    }
  ],
  mediaLibraries: [
    {
      id: "library-primary-github",
      title: "Primary GitHub Media Mirror",
      kind: "github",
      baseUrl: "https://github.com/srmrox/dervaish-media",
      isPrimary: true,
      createdAt: "2026-03-10T08:00:00.000Z",
      updatedAt: "2026-03-10T08:00:00.000Z"
    },
    {
      id: "library-imported-web-public",
      title: "Imported Web Public Media",
      kind: "storage",
      baseUrl: "/imported-media",
      isPrimary: false,
      createdAt: "2026-05-09T00:00:00.000Z",
      updatedAt: "2026-05-09T00:00:00.000Z"
    }
  ],
  mediaMirrors: [
    {
      id: "mirror-river-opus-primary",
      libraryId: "library-primary-github",
      trackId: "track-sindh-river",
      kind: "audio",
      format: "opus",
      sourceUrl: "https://github.com/srmrox/dervaish-media/blob/main/audio/sindh-river.opus",
      playbackUrl: "https://raw.githubusercontent.com/srmrox/dervaish-media/main/audio/sindh-river.opus",
      urlSource: "github",
      isAvailable: true,
      lastCheckedAt: "2026-03-10T08:00:00.000Z",
      createdAt: "2026-03-10T08:00:00.000Z",
      updatedAt: "2026-03-10T08:00:00.000Z"
    },
    {
      id: "mirror-river-video-primary",
      libraryId: "library-primary-github",
      trackId: "track-sindh-river",
      kind: "video",
      format: "mp4",
      sourceUrl: "https://raw.githubusercontent.com/srmrox/dervaish-media/main/video/sindh-river-session-1080.mp4",
      playbackUrl: "https://raw.githubusercontent.com/srmrox/dervaish-media/main/video/sindh-river-session-1080.mp4",
      urlSource: "github",
      isAvailable: true,
      lastCheckedAt: "2026-03-10T08:00:00.000Z",
      createdAt: "2026-03-10T08:00:00.000Z",
      updatedAt: "2026-03-10T08:00:00.000Z"
    },
    {
      id: "mirror-tanam-audio-public",
      libraryId: "library-imported-web-public",
      trackId: "track-tanam-farsooda",
      kind: "audio",
      format: "mp3",
      sourceUrl: "/imported-media/tanam-farsooda-ja-para/audio.mp3",
      playbackUrl: "/imported-media/tanam-farsooda-ja-para/audio.mp3",
      urlSource: "storage",
      isAvailable: true,
      lastCheckedAt: "2026-05-09T00:00:00.000Z",
      createdAt: "2026-05-09T00:00:00.000Z",
      updatedAt: "2026-05-09T00:00:00.000Z"
    },
    {
      id: "mirror-tanam-image-public",
      libraryId: "library-imported-web-public",
      trackId: "track-tanam-farsooda",
      kind: "image",
      format: "jpg",
      sourceUrl: "/imported-media/tanam-farsooda-ja-para/image.jpg",
      playbackUrl: "/imported-media/tanam-farsooda-ja-para/image.jpg",
      urlSource: "storage",
      isAvailable: true,
      lastCheckedAt: "2026-05-09T00:00:00.000Z",
      createdAt: "2026-05-09T00:00:00.000Z",
      updatedAt: "2026-05-09T00:00:00.000Z"
    },
    {
      id: "mirror-ya-nabi-audio-public",
      libraryId: "library-imported-web-public",
      trackId: "track-ya-nabi-salam",
      kind: "audio",
      format: "mp3",
      sourceUrl: "/imported-media/ya-nabi-salam-alayka/audio.mp3",
      playbackUrl: "/imported-media/ya-nabi-salam-alayka/audio.mp3",
      urlSource: "storage",
      isAvailable: true,
      lastCheckedAt: "2026-05-09T00:00:00.000Z",
      createdAt: "2026-05-09T00:00:00.000Z",
      updatedAt: "2026-05-09T00:00:00.000Z"
    },
    {
      id: "mirror-ya-nabi-image-public",
      libraryId: "library-imported-web-public",
      trackId: "track-ya-nabi-salam",
      kind: "image",
      format: "jpg",
      sourceUrl: "/imported-media/ya-nabi-salam-alayka/image.jpg",
      playbackUrl: "/imported-media/ya-nabi-salam-alayka/image.jpg",
      urlSource: "storage",
      isAvailable: true,
      lastCheckedAt: "2026-05-09T00:00:00.000Z",
      createdAt: "2026-05-09T00:00:00.000Z",
      updatedAt: "2026-05-09T00:00:00.000Z"
    }
  ]
};

export function searchCatalog(query: string, snapshot: CatalogSnapshot = demoCatalog): SearchResult {
  const q = query.trim().toLowerCase();
  if (!q) {
    return {
      artists: snapshot.artists,
      people: snapshot.people,
      collections: snapshot.collections,
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
    people: snapshot.people.filter((person) => includes(person.name) || includes(person.role) || includes(person.origin ?? "")),
    collections: snapshot.collections.filter((collection) => includes(collection.title)),
    tracks: snapshot.tracks.filter((track) => includes(track.title) || lyricIncludes(track.lyricSet)),
    videos: snapshot.videos.filter((video) => includes(video.title)),
    archiveRecords: snapshot.archiveRecords.filter((record) => includes(record.title) || includes(record.summary) || record.tags.some(includes))
  };
}
