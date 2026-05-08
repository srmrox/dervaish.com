import type { FastifyInstance, FastifyRequest } from "fastify";
import { buildOfflinePlan } from "@dervaish/playback-core";
import {
  anonymousSessionSchema,
  collectionCreateSchema,
  collectionPatchSchema,
  collectionTrackSchema,
  lyricLanguageSchema,
  lyricSegmentsUpdateSchema,
  queueCreateSchema,
  queueItemCreateSchema,
  queueReorderSchema,
  submissionVerificationSchema,
  submissionCreateSchema,
  submissionMediaCreateSchema,
  submissionPatchSchema,
  submissionReviewSchema,
  trackRequestCreateSchema,
  trackRequestPatchSchema,
  videoGenerationJobCreateSchema
} from "@dervaish/validation";
import {
  addLyricLanguage,
  addCollectionTrack,
  addQueueItem,
  addSubmissionMedia,
  cancelVideoGenerationJob,
  createCollection,
  createCollectionShareToken,
  createQueue,
  createSubmission,
  createTrackRequest,
  createVideoGenerationJob,
  findCollection,
  findArchiveRecord,
  findMediaAsset,
  findPerson,
  findQueue,
  findSubmission,
  findSubmissionWithVerification,
  findTrack,
  findTrackWithVotes,
  findVideo,
  findVideoGenerationJob,
  getCatalogSnapshot,
  listCommunitySubmissions,
  listQueues,
  listOfflinePackages,
  listSubmissions,
  listTrackRequests,
  publishSubmission,
  removeCollectionTrack,
  removeQueueItem,
  reorderQueueItems,
  replaceLyricSegments,
  reviewSubmission,
  search,
  submitSubmission,
  toggleTrackRequestUpvote,
  toggleTrackUpvote,
  updateTrackRequestStatus,
  upsertSubmissionVerification,
  updateCollection,
  updateSubmission
} from "./data-store.js";
import type { RequestUser } from "./data-store.js";
import type { UserRole } from "@dervaish/domain";

function notFound(entity: string) {
  return { error: `${entity} not found` };
}

function headerValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function currentUser(request: FastifyRequest): RequestUser {
  const role = String(headerValue(request.headers["x-dervaish-role"]) ?? "anonymous") as UserRole;
  return {
    id: String(headerValue(request.headers["x-dervaish-user-id"]) ?? (role === "anonymous" ? "anonymous" : `${role}-web`)),
    role
  };
}

function forbidden() {
  return { error: "Signed-in community role required" };
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

  app.get("/catalog", async (request) => getCatalogSnapshot(currentUser(request)));

  app.get("/catalog/search", async (request) => {
    const { q = "" } = request.query as { q?: string };
    return search(q, currentUser(request));
  });

  app.get("/catalog/collections", async (request) => {
    const catalog = await getCatalogSnapshot(currentUser(request));
    return catalog.collections;
  });

  app.get("/catalog/collections/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { share } = request.query as { share?: string };
    const collection = await findCollection(id, currentUser(request), share);
    if (!collection) return reply.code(404).send(notFound("Collection"));
    return collection;
  });

  app.get("/catalog/tracks/:id", async (request, reply) => {
    const track = await findTrackWithVotes((request.params as { id: string }).id, currentUser(request));
    if (!track) {
      return reply.code(404).send(notFound("Track"));
    }

    return {
      ...track,
      reciters: track.reciterIds.map(findPerson).filter(Boolean),
      writers: track.writerIds.map(findPerson).filter(Boolean),
      relatedArchiveRecords: track.archiveRecordIds
        .map((id) => findArchiveRecord(id))
        .filter(Boolean)
    };
  });

  app.post("/catalog/tracks/:id/upvote", async (request, reply) => {
    const user = currentUser(request);
    if (user.role === "anonymous") return reply.code(403).send(forbidden());
    const track = await toggleTrackUpvote((request.params as { id: string }).id, user);
    if (!track) return reply.code(404).send(notFound("Track"));
    return track;
  });

  app.get("/catalog/people/:id", async (request, reply) => {
    const person = findPerson((request.params as { id: string }).id);
    if (!person) return reply.code(404).send(notFound("Person"));
    const catalog = await getCatalogSnapshot(currentUser(request));
    return {
      ...person,
      tracks: catalog.tracks.filter((track) => track.reciterIds.includes(person.id) || track.writerIds.includes(person.id))
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
      offlinePlan: buildOfflinePlan(pkg, deviceState, ["collection-river"])
    }));
  });

  app.post("/collections", async (request, reply) => {
    const parsed = collectionCreateSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    return reply.code(201).send(await createCollection(currentUser(request), parsed.data));
  });

  app.patch("/collections/:id", async (request, reply) => {
    const parsed = collectionPatchSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const collection = await updateCollection((request.params as { id: string }).id, currentUser(request), parsed.data);
    if (!collection) return reply.code(404).send(notFound("Collection"));
    return collection;
  });

  app.post("/collections/:id/tracks", async (request, reply) => {
    const parsed = collectionTrackSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const collection = await addCollectionTrack((request.params as { id: string }).id, currentUser(request), parsed.data.trackId);
    if (!collection) return reply.code(404).send(notFound("Collection or track"));
    return collection;
  });

  app.delete("/collections/:id/tracks/:trackId", async (request, reply) => {
    const { id, trackId } = request.params as { id: string; trackId: string };
    const collection = await removeCollectionTrack(id, currentUser(request), trackId);
    if (!collection) return reply.code(404).send(notFound("Collection"));
    return collection;
  });

  app.post("/collections/:id/share-token", async (request, reply) => {
    const collection = await createCollectionShareToken((request.params as { id: string }).id, currentUser(request));
    if (!collection) return reply.code(404).send(notFound("Collection"));
    return collection;
  });

  app.get("/me/queues", async (request) => listQueues(currentUser(request)));

  app.post("/me/queues", async (request, reply) => {
    const parsed = queueCreateSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    return reply.code(201).send(await createQueue(currentUser(request), parsed.data));
  });

  app.get("/me/queues/:id", async (request, reply) => {
    const queue = await findQueue((request.params as { id: string }).id, currentUser(request));
    if (!queue) return reply.code(404).send(notFound("Queue"));
    return queue;
  });

  app.post("/me/queues/:id/items", async (request, reply) => {
    const parsed = queueItemCreateSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const queue = await addQueueItem((request.params as { id: string }).id, currentUser(request), parsed.data.trackId);
    if (!queue) return reply.code(404).send(notFound("Queue or track"));
    return queue;
  });

  app.patch("/me/queues/:id/items/reorder", async (request, reply) => {
    const parsed = queueReorderSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const queue = await reorderQueueItems((request.params as { id: string }).id, currentUser(request), parsed.data.itemIds);
    if (!queue) return reply.code(404).send(notFound("Queue"));
    return queue;
  });

  app.delete("/me/queues/:id/items/:itemId", async (request, reply) => {
    const { id, itemId } = request.params as { id: string; itemId: string };
    const queue = await removeQueueItem(id, currentUser(request), itemId);
    if (!queue) return reply.code(404).send(notFound("Queue"));
    return queue;
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

  app.get("/community/track-requests", async (request) => listTrackRequests(currentUser(request)));

  app.post("/community/track-requests", async (request, reply) => {
    const user = currentUser(request);
    if (user.role === "anonymous") return reply.code(403).send(forbidden());
    const parsed = trackRequestCreateSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const created = await createTrackRequest(user, parsed.data);
    if (!created) return reply.code(400).send({ error: "trackId does not reference a known track" });
    return reply.code(201).send(created);
  });

  app.patch("/community/track-requests/:id", async (request, reply) => {
    const user = currentUser(request);
    if (user.role !== "editor" && user.role !== "admin") return reply.code(403).send({ error: "Editor or admin role required" });
    const parsed = trackRequestPatchSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const updated = await updateTrackRequestStatus((request.params as { id: string }).id, user, parsed.data.status);
    if (!updated) return reply.code(404).send(notFound("Track request"));
    return updated;
  });

  app.post("/community/track-requests/:id/upvote", async (request, reply) => {
    const user = currentUser(request);
    if (user.role === "anonymous") return reply.code(403).send(forbidden());
    const requestVote = await toggleTrackRequestUpvote((request.params as { id: string }).id, user);
    if (!requestVote) return reply.code(404).send(notFound("Track request"));
    return requestVote;
  });

  app.get("/community/submissions", async (request, reply) => {
    const submissions = await listCommunitySubmissions(currentUser(request));
    if (!submissions) return reply.code(403).send(forbidden());
    return submissions;
  });

  app.get("/community/submissions/:id", async (request, reply) => {
    const submissions = await listCommunitySubmissions(currentUser(request));
    if (!submissions) return reply.code(403).send(forbidden());
    const submission = submissions.find((item) => item.id === (request.params as { id: string }).id);
    if (!submission) return reply.code(404).send(notFound("Submission"));
    return submission;
  });

  app.post("/community/submissions/:id/verifications", async (request, reply) => {
    const user = currentUser(request);
    if (user.role === "anonymous") return reply.code(403).send(forbidden());
    const parsed = submissionVerificationSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const submission = await upsertSubmissionVerification(user, (request.params as { id: string }).id, parsed.data);
    if (!submission) return reply.code(404).send(notFound("Submission"));
    return submission;
  });

  app.get("/submissions", async (request) => listSubmissions(currentUser(request)));

  app.get("/submissions/:id", async (request, reply) => {
    const submission = await findSubmissionWithVerification((request.params as { id: string }).id, currentUser(request));
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
