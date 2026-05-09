import { z } from "zod";

export const lyricsLineSchema = z.object({
  atMs: z.number().int().nonnegative(),
  text: z.string().min(1)
});

export const lyricsDocumentSchema = z.object({
  id: z.string(),
  language: z.string().min(2),
  source: z.enum(["embedded", "sidecar", "canonical"]),
  lines: z.array(lyricsLineSchema).min(1)
});

export const lyricLanguageSchema = z.object({
  code: z.string().min(2),
  name: z.string().min(2),
  direction: z.enum(["ltr", "rtl"]),
  role: z.enum(["original", "translation", "transliteration"]),
  isPublished: z.boolean().default(false)
});

export const lyricSegmentSchema = z.object({
  id: z.string().optional(),
  startMs: z.number().int().nonnegative(),
  endMs: z.number().int().positive(),
  textByLanguageId: z.record(z.string())
}).refine((segment) => segment.endMs > segment.startMs, {
  message: "endMs must be greater than startMs",
  path: ["endMs"]
});

export const lyricSegmentsUpdateSchema = z.object({
  segments: z.array(lyricSegmentSchema).min(1)
});

export const sourceRatingSchema = z.object({
  id: z.string(),
  kind: z.enum(["editorial", "community"]),
  value: z.number().min(0).max(5),
  maxValue: z.literal(5),
  rationale: z.string().min(1),
  contributor: z.string().min(1),
  createdAt: z.string().datetime()
});

export const citationSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1),
  sourceType: z.enum(["interview", "book", "field-recording", "website", "manuscript"]),
  author: z.string().optional(),
  publishedAt: z.string().optional(),
  url: z.string().url().optional(),
  note: z.string().min(1)
});

export const archiveRecordSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  summary: z.string().min(1),
  visibility: z.enum(["public", "private", "pending-review"]),
  tags: z.array(z.string()).default([]),
  citations: z.array(citationSchema),
  ratings: z.array(sourceRatingSchema),
  editorialNotes: z.string().min(1),
  contributorNotes: z.array(z.string()),
  relatedArtistIds: z.array(z.string()),
  relatedCollectionIds: z.array(z.string()),
  relatedTrackIds: z.array(z.string()),
  exportFormats: z.array(z.enum(["json", "jsonld", "csv"])),
  revisionCount: z.number().int().positive()
});

export const collectionCreateSchema = z.object({
  title: z.string().min(3).max(160),
  visibility: z.enum(["public", "private"]).default("private"),
  artworkUrl: z.string().url().optional(),
  year: z.number().int().min(0).max(9999).optional(),
  trackIds: z.array(z.string().min(1)).default([])
});

export const collectionPatchSchema = collectionCreateSchema.partial();

export const collectionTrackSchema = z.object({
  trackId: z.string().min(1)
});

export const trackRequestCreateSchema = z.object({
  title: z.string().min(3).max(180).optional(),
  trackId: z.string().min(1).optional(),
  reciterName: z.string().min(1).max(160).optional(),
  writerName: z.string().min(1).max(160).optional(),
  notes: z.string().max(2000).optional()
}).refine((input) => Boolean(input.title) || Boolean(input.trackId), {
  message: "Provide a title or trackId",
  path: ["title"]
});

export const trackRequestPatchSchema = z.object({
  status: z.enum(["open", "planned", "fulfilled", "rejected"])
});

export const submissionCreateSchema = z.object({
  title: z.string().min(3),
  submitterId: z.string().min(1),
  correctionForTrackId: z.string().min(1).optional(),
  correctionFields: z.array(z.enum(["lyrics", "writer", "reciter", "source", "metadata", "media"])).default([]),
  voice: z.string().min(1).optional(),
  writer: z.string().min(1).optional(),
  notes: z.string().max(5000).optional(),
  sourceName: z.string().max(500).optional(),
  mediaUrl: z.string().url().optional(),
  citations: z.array(citationSchema).default([])
});

export const correctionSubmissionCreateSchema = z.object({
  submitterId: z.string().min(1),
  title: z.string().min(3).optional(),
  voice: z.string().min(1).optional(),
  writer: z.string().min(1).optional(),
  sourceName: z.string().max(500).optional(),
  notes: z.string().max(5000).optional(),
  correctionFields: z.array(z.enum(["lyrics", "writer", "reciter", "source", "metadata", "media"])).min(1).default(["lyrics", "metadata"])
});

export const submissionPatchSchema = submissionCreateSchema
  .omit({ submitterId: true })
  .partial()
  .extend({
    moderationStatus: z.enum(["draft", "submitted", "under_review", "changes_requested", "approved", "rejected", "published"]).optional()
  });

export const submissionMediaCreateSchema = z.object({
  role: z.enum(["source_audio", "source_video", "cover_image", "supporting_file"]),
  originalFilename: z.string().min(1),
  mimeType: z.string().min(3),
  sizeBytes: z.number().int().nonnegative(),
  durationMs: z.number().int().nonnegative().default(0),
  checksumSha256: z.string().min(8).optional(),
  storageKey: z.string().min(1).optional(),
  sourceUrl: z.string().url().refine((value) => value.startsWith("http://") || value.startsWith("https://"), {
    message: "sourceUrl must use http or https"
  }).optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional()
});

export const submissionReviewSchema = z.object({
  status: z.enum(["under_review", "changes_requested", "approved", "rejected"]),
  note: z.string().min(1).max(2000).optional()
});

export const submissionVerificationSchema = z.object({
  field: z.enum(["writer", "reciter", "lyrics", "source", "overall"]),
  vote: z.enum(["verify", "dispute"]),
  note: z.string().max(2000).optional()
});

export const videoGenerationJobCreateSchema = z.object({
  submissionId: z.string().optional(),
  trackId: z.string().optional(),
  sourceMediaAssetId: z.string().min(1),
  sourceMode: z.enum(["audio_visualizer", "video_overlay"]),
  layoutId: z.string().min(1).default("landscape-1"),
  resolution: z.enum(["720p", "1080p", "4k"]).default("1080p"),
  visibleLanguageIds: z.array(z.string().min(1)).min(1).max(3),
  title: z.string().min(1),
  voice: z.string().optional(),
  writer: z.string().optional(),
  imageAssetIds: z.array(z.string()).default([])
}).refine((input) => Boolean(input.submissionId) !== Boolean(input.trackId), {
  message: "Provide exactly one of submissionId or trackId",
  path: ["submissionId"]
});

export const queueCreateSchema = z.object({
  title: z.string().min(1).max(120)
});

export const queueItemCreateSchema = z.object({
  trackId: z.string().min(1)
});

export const queueReorderSchema = z.object({
  itemIds: z.array(z.string().min(1)).min(1)
});

export const anonymousSessionSchema = z.object({
  fingerprint: z.string().min(6)
});

export const lyricPreferenceSchema = z.object({
  visibleLanguageIds: z.array(z.string().min(1)).min(1)
});

const publicOrHttpUrlSchema = z.string().min(1).refine((value) => {
  if (value.startsWith("/")) return !value.startsWith("//");
  return value.startsWith("http://") || value.startsWith("https://");
}, {
  message: "URL must use http(s) or a public absolute path"
});

export const mediaLibraryCreateSchema = z.object({
  title: z.string().min(3).max(160),
  kind: z.enum(["github", "external", "storage"]),
  baseUrl: publicOrHttpUrlSchema.optional(),
  isPrimary: z.boolean().default(false)
});

export const mediaLibraryPatchSchema = mediaLibraryCreateSchema.partial();

export const mediaMirrorCreateSchema = z.object({
  libraryId: z.string().min(1),
  trackId: z.string().min(1),
  kind: z.enum(["audio", "video", "image"]),
  format: z.enum(["flac", "opus", "aac", "webm", "mp4", "mkv", "mp3", "wav", "jpg", "png"]).optional(),
  sourceUrl: publicOrHttpUrlSchema,
  checksumSha256: z.string().min(8).optional(),
  isAvailable: z.boolean().default(true)
});

export const mediaMirrorPatchSchema = mediaMirrorCreateSchema.omit({ libraryId: true, trackId: true }).partial();
