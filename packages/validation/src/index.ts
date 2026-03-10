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
  id: z.string(),
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
  relatedReleaseIds: z.array(z.string()),
  relatedTrackIds: z.array(z.string()),
  exportFormats: z.array(z.enum(["json", "jsonld", "csv"])),
  revisionCount: z.number().int().positive()
});

export const submissionCreateSchema = z.object({
  title: z.string().min(3),
  submitterId: z.string().min(1),
  mediaUrl: z.string().url().optional(),
  notes: z.string().max(5000).optional()
});

export const anonymousSessionSchema = z.object({
  fingerprint: z.string().min(6)
});

