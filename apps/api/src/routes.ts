import type { FastifyInstance } from "fastify";
import { buildOfflinePlan } from "@dervaish/playback-core";
import { anonymousSessionSchema, submissionCreateSchema } from "@dervaish/validation";
import { createSubmission, findArchiveRecord, findTrack, findVideo, getCatalogSnapshot, listOfflinePackages, search } from "./data-store.js";

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
      features: ["browse-catalog", "browse-archive"]
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
      return reply.code(404).send({ error: "Track not found" });
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
      return reply.code(404).send({ error: "Video not found" });
    }

    return {
      ...video,
      streamManifestUrl: `/playback/video/${video.id}/manifest.m3u8`
    };
  });

  app.get("/archive/records/:id", async (request, reply) => {
    const record = findArchiveRecord((request.params as { id: string }).id);
    if (!record) {
      return reply.code(404).send({ error: "Archive record not found" });
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
      return reply.code(404).send({ error: "Track not found" });
    }

    return {
      trackId: track.id,
      preferredAssetId: track.mediaAssets.find((asset) => asset.format === "opus")?.id ?? track.mediaAssets[0]?.id,
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
}

