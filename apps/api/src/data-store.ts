import {
  demoCatalog,
  searchCatalog,
  type CatalogSnapshot,
  type Citation,
  type LyricLanguage,
  type LyricSegment,
  type MediaAsset,
  type Submission,
  type SubmissionMedia,
  type SubmissionStatus,
  type VideoGenerationJob
} from "@dervaish/domain";

const snapshot: CatalogSnapshot = structuredClone(demoCatalog);

function now() {
  return new Date().toISOString();
}

function nextId(prefix: string, count: number) {
  return `${prefix}-${String(count + 1).padStart(3, "0")}`;
}

function mediaFormatFromMime(mimeType: string): MediaAsset["format"] {
  if (mimeType.includes("mpeg")) return "mp3";
  if (mimeType.includes("wav")) return "wav";
  if (mimeType.includes("flac")) return "flac";
  if (mimeType.includes("webm")) return "webm";
  if (mimeType.includes("matroska")) return "mkv";
  if (mimeType.includes("png")) return "png";
  if (mimeType.includes("jpeg") || mimeType.includes("jpg")) return "jpg";
  return "mp4";
}

function mediaKindFromRole(role: SubmissionMedia["role"]): MediaAsset["kind"] {
  if (role === "source_audio") return "audio";
  if (role === "cover_image" || role === "supporting_file") return "image";
  return "video";
}

export function getCatalogSnapshot() {
  return snapshot;
}

export function findTrack(id: string) {
  return snapshot.tracks.find((track) => track.id === id);
}

export function findVideo(id: string) {
  return snapshot.videos.find((video) => video.id === id);
}

export function findArchiveRecord(id: string) {
  return snapshot.archiveRecords.find((record) => record.id === id);
}

export function findMediaAsset(id: string) {
  return snapshot.mediaAssets.find((asset) => asset.id === id);
}

export function listOfflinePackages() {
  return snapshot.offlinePackages;
}

export function search(query: string) {
  return searchCatalog(query, snapshot);
}

export function listSubmissions() {
  return snapshot.submissions;
}

export function findSubmission(id: string) {
  return snapshot.submissions.find((submission) => submission.id === id);
}

export function createSubmission(input: {
  submitterId: string;
  title: string;
  voice?: string;
  writer?: string;
  notes?: string;
  sourceName?: string;
  citations?: Array<Omit<Citation, "id"> & { id?: string }>;
}): Submission {
  const timestamp = now();
  const submission: Submission = {
    id: nextId("submission", snapshot.submissions.length),
    submitterId: input.submitterId,
    title: input.title,
    voice: input.voice,
    writer: input.writer,
    notes: input.notes,
    sourceName: input.sourceName,
    visibility: "private",
    moderationStatus: "draft",
    createdAt: timestamp,
    updatedAt: timestamp,
    lyricSet: {
      id: nextId("lyrics-submission", snapshot.submissions.length),
      source: "submitted",
      languages: [],
      segments: []
    },
    citations: (input.citations ?? []).map((citation, index) => ({
      ...citation,
      id: citation.id ?? nextId("citation-submission", index)
    })),
    media: [],
    reviewNotes: [],
    generatedVideoJobIds: []
  };

  snapshot.submissions.unshift(submission);
  return submission;
}

export function updateSubmission(id: string, input: Partial<Pick<Submission, "title" | "voice" | "writer" | "notes" | "sourceName" | "moderationStatus">>) {
  const submission = findSubmission(id);
  if (!submission) return undefined;
  Object.assign(submission, input, { updatedAt: now() });
  return submission;
}

export function addSubmissionMedia(
  submissionId: string,
  input: {
    role: SubmissionMedia["role"];
    originalFilename: string;
    mimeType: string;
    sizeBytes: number;
    durationMs: number;
    checksumSha256?: string;
    storageKey?: string;
    width?: number;
    height?: number;
  }
) {
  const submission = findSubmission(submissionId);
  if (!submission) return undefined;

  const asset: MediaAsset = {
    id: nextId("asset-submission", snapshot.mediaAssets.length),
    kind: mediaKindFromRole(input.role),
    format: mediaFormatFromMime(input.mimeType),
    durationMs: input.durationMs,
    sizeBytes: input.sizeBytes,
    storageKey: input.storageKey ?? `submissions/${submissionId}/${input.originalFilename}`,
    isMaster: true,
    originalFilename: input.originalFilename,
    mimeType: input.mimeType,
    checksumSha256: input.checksumSha256,
    width: input.width,
    height: input.height
  };

  const media: SubmissionMedia = {
    id: nextId("submission-media", submission.media.length),
    submissionId,
    assetId: asset.id,
    role: input.role,
    uploadedAt: now()
  };

  snapshot.mediaAssets.push(asset);
  submission.media.push(media);
  submission.updatedAt = now();
  return { submission, media, asset };
}

export function addLyricLanguage(submissionId: string, input: Omit<LyricLanguage, "id">) {
  const submission = findSubmission(submissionId);
  if (!submission) return undefined;
  const language: LyricLanguage = {
    id: nextId("lang-submission", submission.lyricSet.languages.length),
    ...input
  };
  submission.lyricSet.languages.push(language);
  submission.updatedAt = now();
  return language;
}

export function replaceLyricSegments(submissionId: string, segments: Array<Omit<LyricSegment, "id"> & { id?: string }>) {
  const submission = findSubmission(submissionId);
  if (!submission) return undefined;
  submission.lyricSet.segments = segments.map((segment, index) => ({
    id: segment.id ?? nextId("segment-submission", index),
    startMs: segment.startMs,
    endMs: segment.endMs,
    textByLanguageId: segment.textByLanguageId
  }));
  submission.updatedAt = now();
  return submission.lyricSet;
}

export function submitSubmission(id: string) {
  const submission = findSubmission(id);
  if (!submission) return undefined;
  submission.moderationStatus = "submitted";
  submission.submittedAt = now();
  submission.updatedAt = now();
  return submission;
}

export function reviewSubmission(id: string, status: Exclude<SubmissionStatus, "draft" | "submitted" | "published">, note?: string) {
  const submission = findSubmission(id);
  if (!submission) return undefined;
  submission.moderationStatus = status;
  if (note) submission.reviewNotes.unshift(`${now()}: ${note}`);
  submission.updatedAt = now();
  return submission;
}

export function publishSubmission(id: string) {
  const submission = findSubmission(id);
  if (!submission) return undefined;
  submission.moderationStatus = "published";
  submission.visibility = "public";
  submission.updatedAt = now();
  return submission;
}

export function createVideoGenerationJob(input: {
  submissionId?: string;
  trackId?: string;
  sourceMediaAssetId: string;
  sourceMode: VideoGenerationJob["sourceMode"];
  layoutId: string;
  resolution: VideoGenerationJob["resolution"];
  visibleLanguageIds: string[];
  title: string;
  voice?: string;
  writer?: string;
  imageAssetIds: string[];
}) {
  const timestamp = now();
  const job: VideoGenerationJob = {
    id: nextId("video-job", snapshot.videoGenerationJobs.length),
    submissionId: input.submissionId,
    trackId: input.trackId,
    sourceMediaAssetId: input.sourceMediaAssetId,
    sourceMode: input.sourceMode,
    layoutId: input.layoutId,
    resolution: input.resolution,
    visibleLanguageIds: input.visibleLanguageIds.slice(0, 3),
    title: input.title,
    voice: input.voice,
    writer: input.writer,
    imageAssetIds: input.imageAssetIds,
    status: "queued",
    progress: 0,
    logs: ["Queued for Python MoviePy video generation."],
    outputAssetIds: [],
    createdAt: timestamp,
    updatedAt: timestamp
  };

  snapshot.videoGenerationJobs.unshift(job);
  if (input.submissionId) {
    const submission = findSubmission(input.submissionId);
    submission?.generatedVideoJobIds.unshift(job.id);
  }
  return job;
}

export function findVideoGenerationJob(id: string) {
  return snapshot.videoGenerationJobs.find((job) => job.id === id);
}

export function cancelVideoGenerationJob(id: string) {
  const job = findVideoGenerationJob(id);
  if (!job || job.status === "completed" || job.status === "failed") return job;
  job.status = "cancelled";
  job.progress = 0;
  job.logs.unshift("Cancelled before worker execution.");
  job.updatedAt = now();
  return job;
}
