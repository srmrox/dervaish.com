import type { FastifyInstance } from "fastify";
import { buildOfflinePlan } from "@dervaish/playback-core";
import {
  anonymousSessionSchema,
  lyricLanguageSchema,
  lyricSegmentsUpdateSchema,
  submissionCreateSchema,
  submissionMediaCreateSchema,
  submissionPatchSchema,
  submissionReviewSchema,
  videoGenerationJobCreateSchema
} from "@dervaish/validation";
import {
  addLyricLanguage,
  addSubmissionMedia,
  cancelVideoGenerationJob,
  createSubmission,
  createVideoGenerationJob,
  findArchiveRecord,
  findMediaAsset,
  findSubmission,
  findTrack,
  findVideo,
  findVideoGenerationJob,
  getCatalogSnapshot,
  listOfflinePackages,
  listSubmissions,
  publishSubmission,
  replaceLyricSegments,
  reviewSubmission,
  search,
  submitSubmission,
  updateSubmission
} from "./data-store.js";

function notFound(entity: string) {
  return { error: `${entity} not found` };
}

export async function registerRoutes(app: FastifyInstance) {
  app.get("/health", async () => ({ ok: true, service: "dervaish-api" }));

  app.post("/auth/anonymous-session", async (request, reply) => {
    const parsed = anonymousSessionSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    return {
      role: "anonymous",
      sessionId: `anon-${parsed.data.fingerprint}`,
      features: ["browse-catalog", "browse-archive", "create-submission"]
    };
  });

  app.get("/catalog", async () => getCatalogSnapshot());

  app.get("/catalog/search", async (request) => {
    const { q = "" } = request.query as { q?: string };
    return search(q);
  });

  app.get("/catalog/tracks/:id", async (request, reply) => {
    const track = findTrack((request.params as { id: string }).id);
    if (!track) {
      return reply.code(404).send(notFound("Track"));
    }

    return {
      ...track,
      relatedArchiveRecords: track.archiveRecordIds
        .map((id) => findArchiveRecord(id))
        .filter(Boolean)
    };
  });

  app.get("/catalog/videos/:id", async (request, reply) => {
    const video = findVideo((request.params as { id: string }).id);
    if (!video) {
      return reply.code(404).send(notFound("Video"));
    }

    return {
      ...video,
      streamManifestUrl: `/playback/video/${video.id}/manifest.m3u8`
    };
  });

  app.get("/archive/records/:id", async (request, reply) => {
    const record = findArchiveRecord((request.params as { id: string }).id);
    if (!record) {
      return reply.code(404).send(notFound("Archive record"));
    }
    return record;
  });

  app.get("/offline/packages", async () => {
    const deviceState = {
      deviceId: "web-demo",
      userId: "anonymous",
      smartCacheEnabled: true,
      mirrorModeEnabled: false,
      storageBudgetBytes: 500_000_000,
      lastSyncedAt: new Date().toISOString()
    };

    return listOfflinePackages().map((pkg) => ({
      ...pkg,
      offlinePlan: buildOfflinePlan(pkg, deviceState, ["release-river"])
    }));
  });

  app.get("/playback/tracks/:id", async (request, reply) => {
    const track = findTrack((request.params as { id: string }).id);
    if (!track) {
      return reply.code(404).send(notFound("Track"));
    }

    return {
      trackId: track.id,
      preferredAssetId: track.mediaAssets.find((asset) => asset.format === "opus")?.id ?? track.mediaAssets[0]?.id,
      lyricSet: track.lyricSet,
      lyrics: track.lyrics,
      resumePositionMs: 0
    };
  });

  app.post("/submissions", async (request, reply) => {
    const parsed = submissionCreateSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    return reply.code(201).send(createSubmission(parsed.data));
  });

  app.get("/submissions", async () => listSubmissions());

  app.get("/submissions/:id", async (request, reply) => {
    const submission = findSubmission((request.params as { id: string }).id);
    if (!submission) return reply.code(404).send(notFound("Submission"));
    return submission;
  });

  app.patch("/submissions/:id", async (request, reply) => {
    const parsed = submissionPatchSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const submission = updateSubmission((request.params as { id: string }).id, parsed.data);
    if (!submission) return reply.code(404).send(notFound("Submission"));
    return submission;
  });

  app.post("/submissions/:id/media", async (request, reply) => {
    const parsed = submissionMediaCreateSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const result = addSubmissionMedia((request.params as { id: string }).id, parsed.data);
    if (!result) return reply.code(404).send(notFound("Submission"));
    return reply.code(201).send(result);
  });

  app.post("/submissions/:id/lyrics/languages", async (request, reply) => {
    const parsed = lyricLanguageSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const language = addLyricLanguage((request.params as { id: string }).id, parsed.data);
    if (!language) return reply.code(404).send(notFound("Submission"));
    return reply.code(201).send(language);
  });

  app.put("/submissions/:id/lyrics/segments", async (request, reply) => {
    const parsed = lyricSegmentsUpdateSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const lyricSet = replaceLyricSegments((request.params as { id: string }).id, parsed.data.segments);
    if (!lyricSet) return reply.code(404).send(notFound("Submission"));
    return lyricSet;
  });

  app.post("/submissions/:id/submit", async (request, reply) => {
    const submission = submitSubmission((request.params as { id: string }).id);
    if (!submission) return reply.code(404).send(notFound("Submission"));
    return submission;
  });

  app.patch("/submissions/:id/review", async (request, reply) => {
    const parsed = submissionReviewSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const submission = reviewSubmission((request.params as { id: string }).id, parsed.data.status, parsed.data.note);
    if (!submission) return reply.code(404).send(notFound("Submission"));
    return submission;
  });

  app.post("/submissions/:id/publish", async (request, reply) => {
    const submission = publishSubmission((request.params as { id: string }).id);
    if (!submission) return reply.code(404).send(notFound("Submission"));
    return submission;
  });

  app.post("/video-generation/jobs", async (request, reply) => {
    const parsed = videoGenerationJobCreateSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    if (!findMediaAsset(parsed.data.sourceMediaAssetId)) {
      return reply.code(400).send({ error: "sourceMediaAssetId does not reference a known media asset" });
    }
    const job = createVideoGenerationJob(parsed.data);
    return reply.code(201).send(job);
  });

  app.get("/video-generation/jobs/:id", async (request, reply) => {
    const job = findVideoGenerationJob((request.params as { id: string }).id);
    if (!job) return reply.code(404).send(notFound("Video generation job"));
    return job;
  });

  app.post("/video-generation/jobs/:id/cancel", async (request, reply) => {
    const job = cancelVideoGenerationJob((request.params as { id: string }).id);
    if (!job) return reply.code(404).send(notFound("Video generation job"));
    return job;
  });
}
