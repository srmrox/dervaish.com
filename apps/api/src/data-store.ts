import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import {
  demoCatalog,
  searchCatalog,
  type CatalogSnapshot,
  type Citation,
  type Collection,
  type LyricLanguage,
  type LyricSegment,
  type MediaAsset,
  type Submission,
  type SubmissionMedia,
  type SubmissionStatus,
  type SubmissionVerification,
  type SubmissionVerificationField,
  type SubmissionVerificationSummary,
  type SubmissionVerificationVote,
  type Track,
  type TrackRequest,
  type TrackRequestStatus,
  type UserQueue,
  type UserQueueItem,
  type UserRole,
  type VideoGenerationJob
} from "@dervaish/domain";

const snapshot: CatalogSnapshot = structuredClone(demoCatalog);
const memoryQueues: UserQueue[] = [];
const memoryTrackRequests: TrackRequest[] = structuredClone(demoCatalog.trackRequests);
const memoryTrackRequestVotes: Array<{ requestId: string; userId: string; createdAt: string }> = [];
const memoryTrackVotes: Array<{ trackId: string; userId: string; createdAt: string }> = [];
const memorySubmissionVerifications: SubmissionVerification[] = [];
const defaultArtworkUrl = demoCatalog.collections[0]?.artworkUrl ?? "https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=1200&q=80";
const databaseUrl = process.env.DATABASE_URL === "" ? "" : (process.env.DATABASE_URL ?? "postgres://dervaish:dervaish@localhost:5432/dervaish");
const pool = databaseUrl ? new pg.Pool({ connectionString: databaseUrl }) : undefined;
let dbReady: Promise<void> | undefined;

export interface RequestUser {
  id: string;
  role: UserRole;
}

function now() {
  return new Date().toISOString();
}

function nextId(prefix: string, count: number) {
  return `${prefix}-${String(count + 1).padStart(3, "0")}`;
}

function slugId(prefix: string, title: string) {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "item";
  return `${prefix}-${slug}-${randomBytes(3).toString("hex")}`;
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

function canUseCommunity(user: RequestUser) {
  return user.role !== "anonymous";
}

function isEditor(user: RequestUser) {
  return user.role === "editor" || user.role === "admin";
}

function rowToCollection(row: Record<string, unknown>): Collection {
  return {
    id: String(row.id),
    title: String(row.title),
    ownerUserId: String(row.owner_user_id),
    createdByRole: String(row.created_by_role) as UserRole,
    visibility: String(row.visibility) as Collection["visibility"],
    isCurated: Boolean(row.is_curated),
    artworkUrl: String(row.artwork_url),
    year: row.year === null || row.year === undefined ? undefined : Number(row.year),
    trackIds: Array.isArray(row.track_ids) ? row.track_ids.map(String) : [],
    shareToken: row.share_token ? String(row.share_token) : undefined,
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString()
  };
}

function rowToQueue(row: Record<string, unknown>, items: UserQueueItem[] = []): UserQueue {
  return {
    id: String(row.id),
    ownerUserId: String(row.owner_user_id),
    title: String(row.title),
    items,
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString()
  };
}

function emptyVerificationSummary(): SubmissionVerificationSummary {
  return {
    writer: { verify: 0, dispute: 0 },
    reciter: { verify: 0, dispute: 0 },
    lyrics: { verify: 0, dispute: 0 },
    source: { verify: 0, dispute: 0 },
    overall: { verify: 0, dispute: 0 }
  };
}

function rowToTrackRequest(row: Record<string, unknown>, upvoteCount: number, upvotedByCurrentUser: boolean): TrackRequest {
  return {
    id: String(row.id),
    title: String(row.title),
    trackId: row.track_id ? String(row.track_id) : undefined,
    reciterName: row.reciter_name ? String(row.reciter_name) : undefined,
    writerName: row.writer_name ? String(row.writer_name) : undefined,
    notes: row.notes ? String(row.notes) : undefined,
    requesterUserId: String(row.requester_user_id),
    status: String(row.status) as TrackRequestStatus,
    upvoteCount,
    upvotedByCurrentUser,
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString()
  };
}

function rowToSubmissionVerification(row: Record<string, unknown>): SubmissionVerification {
  return {
    id: String(row.id),
    submissionId: String(row.submission_id),
    verifierUserId: String(row.verifier_user_id),
    field: String(row.field) as SubmissionVerificationField,
    vote: String(row.vote) as SubmissionVerificationVote,
    note: row.note ? String(row.note) : undefined,
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString()
  };
}

async function ensureDb() {
  if (!pool) return;
  dbReady ??= (async () => {
    const migrationDir = join(dirname(fileURLToPath(import.meta.url)), "../migrations");
    await pool.query(await readFile(join(migrationDir, "001_collections_people_queues.sql"), "utf8"));
    await pool.query(await readFile(join(migrationDir, "002_community_features.sql"), "utf8"));
    const count = await pool.query<{ count: string }>("SELECT COUNT(*)::text AS count FROM collections");
    if (Number(count.rows[0]?.count ?? 0) === 0) {
      for (const collection of demoCatalog.collections) {
        await upsertCollection(collection);
      }
    }
    const requestCount = await pool.query<{ count: string }>("SELECT COUNT(*)::text AS count FROM track_requests");
    if (Number(requestCount.rows[0]?.count ?? 0) === 0) {
      for (const request of demoCatalog.trackRequests) {
        await pool.query(
          `INSERT INTO track_requests (id, title, track_id, reciter_name, writer_name, notes, requester_user_id, status, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           ON CONFLICT (id) DO NOTHING`,
          [
            request.id,
            request.title,
            request.trackId ?? null,
            request.reciterName ?? null,
            request.writerName ?? null,
            request.notes ?? null,
            request.requesterUserId,
            request.status,
            request.createdAt,
            request.updatedAt
          ]
        );
      }
    }
  })();
  await dbReady;
}

async function upsertCollection(collection: Collection) {
  if (!pool) return;
  await pool.query(
    `INSERT INTO collections (
      id, title, owner_user_id, created_by_role, visibility, is_curated, artwork_url, year, track_ids, share_token, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11, $12)
    ON CONFLICT (id) DO UPDATE SET
      title = EXCLUDED.title,
      owner_user_id = EXCLUDED.owner_user_id,
      created_by_role = EXCLUDED.created_by_role,
      visibility = EXCLUDED.visibility,
      is_curated = EXCLUDED.is_curated,
      artwork_url = EXCLUDED.artwork_url,
      year = EXCLUDED.year,
      track_ids = EXCLUDED.track_ids,
      share_token = EXCLUDED.share_token,
      updated_at = EXCLUDED.updated_at`,
    [
      collection.id,
      collection.title,
      collection.ownerUserId,
      collection.createdByRole,
      collection.visibility,
      collection.isCurated,
      collection.artworkUrl,
      collection.year ?? null,
      JSON.stringify(collection.trackIds),
      collection.shareToken ?? null,
      collection.createdAt,
      collection.updatedAt
    ]
  );
}

async function listDbCollections(user?: RequestUser, includeShareToken?: string) {
  await ensureDb();
  if (!pool) return snapshot.collections;
  const result = await pool.query(
    `SELECT * FROM collections
     WHERE visibility = 'public' OR owner_user_id = $1 OR share_token = $2
     ORDER BY is_curated DESC, created_at ASC`,
    [user?.id ?? "anonymous", includeShareToken ?? ""]
  );
  return result.rows.map(rowToCollection);
}

export async function getCatalogSnapshot(user?: RequestUser) {
  return {
    ...snapshot,
    collections: await listDbCollections(user),
    tracks: await withTrackVotes(snapshot.tracks, user),
    submissions: await listSubmissions(user),
    trackRequests: await listTrackRequests(user)
  };
}

export async function findCollection(id: string, user?: RequestUser, shareToken?: string) {
  await ensureDb();
  if (!pool) {
    return snapshot.collections.find((collection) => collection.id === id);
  }
  const result = await pool.query(
    `SELECT * FROM collections
     WHERE id = $1 AND (visibility = 'public' OR owner_user_id = $2 OR share_token = $3)`,
    [id, user?.id ?? "anonymous", shareToken ?? ""]
  );
  return result.rows[0] ? rowToCollection(result.rows[0]) : undefined;
}

export function findTrack(id: string) {
  return snapshot.tracks.find((track) => track.id === id);
}

export async function findTrackWithVotes(id: string, user?: RequestUser) {
  const track = findTrack(id);
  if (!track) return undefined;
  return (await withTrackVotes([track], user))[0];
}

export function findPerson(id: string) {
  return snapshot.people.find((person) => person.id === id);
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

export async function search(query: string, user?: RequestUser) {
  return searchCatalog(query, await getCatalogSnapshot(user));
}

export async function withTrackVotes(tracks: Track[], user?: RequestUser): Promise<Track[]> {
  await ensureDb();
  if (!pool) {
    return tracks.map((track) => ({
      ...track,
      upvoteCount: memoryTrackVotes.filter((vote) => vote.trackId === track.id).length,
      upvotedByCurrentUser: Boolean(user && memoryTrackVotes.some((vote) => vote.trackId === track.id && vote.userId === user.id))
    }));
  }
  if (!tracks.length) return [];
  const ids = tracks.map((track) => track.id);
  const counts = await pool.query<{ track_id: string; count: string }>(
    "SELECT track_id, COUNT(*)::text AS count FROM track_votes WHERE track_id = ANY($1) GROUP BY track_id",
    [ids]
  );
  const currentVotes = user
    ? await pool.query<{ track_id: string }>("SELECT track_id FROM track_votes WHERE user_id = $1 AND track_id = ANY($2)", [user.id, ids])
    : { rows: [] };
  const countMap = new Map(counts.rows.map((row) => [row.track_id, Number(row.count)]));
  const currentSet = new Set(currentVotes.rows.map((row) => row.track_id));
  return tracks.map((track) => ({
    ...track,
    upvoteCount: countMap.get(track.id) ?? 0,
    upvotedByCurrentUser: currentSet.has(track.id)
  }));
}

export async function toggleTrackUpvote(trackId: string, user: RequestUser) {
  if (!canUseCommunity(user) || !findTrack(trackId)) return undefined;
  await ensureDb();
  if (!pool) {
    const index = memoryTrackVotes.findIndex((vote) => vote.trackId === trackId && vote.userId === user.id);
    if (index >= 0) memoryTrackVotes.splice(index, 1);
    else memoryTrackVotes.push({ trackId, userId: user.id, createdAt: now() });
    return findTrackWithVotes(trackId, user);
  }
  const existing = await pool.query("SELECT 1 FROM track_votes WHERE track_id = $1 AND user_id = $2", [trackId, user.id]);
  if (existing.rowCount) {
    await pool.query("DELETE FROM track_votes WHERE track_id = $1 AND user_id = $2", [trackId, user.id]);
  } else {
    await pool.query("INSERT INTO track_votes (track_id, user_id, created_at) VALUES ($1, $2, $3)", [trackId, user.id, now()]);
  }
  return findTrackWithVotes(trackId, user);
}

export async function createCollection(user: RequestUser, input: {
  title: string;
  visibility?: Collection["visibility"];
  artworkUrl?: string;
  year?: number;
  trackIds?: string[];
}) {
  const timestamp = now();
  const collection: Collection = {
    id: slugId("collection", input.title),
    title: input.title,
    ownerUserId: user.id,
    createdByRole: user.role,
    visibility: input.visibility ?? "private",
    isCurated: user.role === "admin" || user.role === "editor",
    artworkUrl: input.artworkUrl ?? defaultArtworkUrl,
    year: input.year,
    trackIds: [...new Set(input.trackIds ?? [])].filter((trackId) => Boolean(findTrack(trackId))),
    createdAt: timestamp,
    updatedAt: timestamp
  };
  if (pool) {
    await ensureDb();
    await upsertCollection(collection);
  } else {
    snapshot.collections.unshift(collection);
  }
  return collection;
}

export async function updateCollection(id: string, user: RequestUser, input: Partial<Pick<Collection, "title" | "visibility" | "artworkUrl" | "year" | "trackIds">>) {
  const collection = await findCollection(id, user);
  if (!collection || collection.ownerUserId !== user.id) return undefined;
  const updated: Collection = {
    ...collection,
    ...input,
    artworkUrl: input.artworkUrl ?? collection.artworkUrl,
    trackIds: input.trackIds ? [...new Set(input.trackIds)].filter((trackId) => Boolean(findTrack(trackId))) : collection.trackIds,
    updatedAt: now()
  };
  if (pool) {
    await upsertCollection(updated);
  } else {
    const index = snapshot.collections.findIndex((item) => item.id === id);
    if (index >= 0) snapshot.collections[index] = updated;
  }
  return updated;
}

export async function addCollectionTrack(id: string, user: RequestUser, trackId: string) {
  const collection = await findCollection(id, user);
  if (!collection || collection.ownerUserId !== user.id || !findTrack(trackId)) return undefined;
  if (!collection.trackIds.includes(trackId)) collection.trackIds.push(trackId);
  return updateCollection(id, user, { trackIds: collection.trackIds });
}

export async function removeCollectionTrack(id: string, user: RequestUser, trackId: string) {
  const collection = await findCollection(id, user);
  if (!collection || collection.ownerUserId !== user.id) return undefined;
  return updateCollection(id, user, { trackIds: collection.trackIds.filter((item) => item !== trackId) });
}

export async function createCollectionShareToken(id: string, user: RequestUser) {
  const collection = await findCollection(id, user);
  if (!collection || collection.ownerUserId !== user.id) return undefined;
  const updated: Collection = { ...collection, shareToken: collection.shareToken ?? randomBytes(16).toString("hex"), updatedAt: now() };
  if (pool) {
    await upsertCollection(updated);
  } else {
    const index = snapshot.collections.findIndex((item) => item.id === id);
    if (index >= 0) snapshot.collections[index] = updated;
  }
  return updated;
}

async function queueItems(queueId: string) {
  if (!pool) return [];
  const result = await pool.query("SELECT * FROM queue_items WHERE queue_id = $1 ORDER BY position ASC", [queueId]);
  return result.rows.map((row): UserQueueItem => ({
    id: String(row.id),
    queueId: String(row.queue_id),
    trackId: String(row.track_id),
    position: Number(row.position),
    addedAt: new Date(String(row.added_at)).toISOString()
  }));
}

export async function listQueues(user: RequestUser) {
  await ensureDb();
  if (!pool) return memoryQueues.filter((queue) => queue.ownerUserId === user.id);
  const result = await pool.query("SELECT * FROM queues WHERE owner_user_id = $1 ORDER BY created_at ASC", [user.id]);
  return Promise.all(result.rows.map(async (row) => rowToQueue(row, await queueItems(String(row.id)))));
}

export async function createQueue(user: RequestUser, input: { title: string }) {
  await ensureDb();
  const timestamp = now();
  const queue: UserQueue = {
    id: slugId("queue", input.title),
    ownerUserId: user.id,
    title: input.title,
    items: [],
    createdAt: timestamp,
    updatedAt: timestamp
  };
  if (pool) {
    await pool.query(
      "INSERT INTO queues (id, owner_user_id, title, created_at, updated_at) VALUES ($1, $2, $3, $4, $5)",
      [queue.id, queue.ownerUserId, queue.title, queue.createdAt, queue.updatedAt]
    );
  } else {
    memoryQueues.push(queue);
  }
  return queue;
}

export async function findQueue(id: string, user: RequestUser) {
  await ensureDb();
  if (!pool) return memoryQueues.find((queue) => queue.id === id && queue.ownerUserId === user.id);
  const result = await pool.query("SELECT * FROM queues WHERE id = $1 AND owner_user_id = $2", [id, user.id]);
  return result.rows[0] ? rowToQueue(result.rows[0], await queueItems(id)) : undefined;
}

export async function addQueueItem(queueId: string, user: RequestUser, trackId: string) {
  if (!findTrack(trackId)) return undefined;
  const queue = await findQueue(queueId, user);
  if (!queue) return undefined;
  const position = queue.items.length;
  const item: UserQueueItem = {
    id: slugId("queue-item", trackId),
    queueId,
    trackId,
    position,
    addedAt: now()
  };
  if (!pool) {
    queue.items.push(item);
    queue.updatedAt = now();
    return queue;
  }
  await pool.query("INSERT INTO queue_items (id, queue_id, track_id, position, added_at) VALUES ($1, $2, $3, $4, $5)", [
    item.id,
    item.queueId,
    item.trackId,
    item.position,
    item.addedAt
  ]);
  await pool.query("UPDATE queues SET updated_at = $1 WHERE id = $2", [now(), queueId]);
  return findQueue(queueId, user);
}

export async function reorderQueueItems(queueId: string, user: RequestUser, itemIds: string[]) {
  const queue = await findQueue(queueId, user);
  if (!queue) return undefined;
  const existing = new Set(queue.items.map((item) => item.id));
  if (itemIds.some((id) => !existing.has(id))) return undefined;
  if (!pool) {
    queue.items = itemIds
      .map((itemId, index) => {
        const item = queue.items.find((candidate) => candidate.id === itemId);
        return item ? { ...item, position: index } : undefined;
      })
      .filter((item): item is UserQueueItem => Boolean(item));
    queue.updatedAt = now();
    return queue;
  }
  await Promise.all(itemIds.map((itemId, index) => pool.query("UPDATE queue_items SET position = $1 WHERE id = $2 AND queue_id = $3", [index, itemId, queueId])));
  await pool.query("UPDATE queues SET updated_at = $1 WHERE id = $2", [now(), queueId]);
  return findQueue(queueId, user);
}

export async function removeQueueItem(queueId: string, user: RequestUser, itemId: string) {
  const queue = await findQueue(queueId, user);
  if (!queue) return undefined;
  if (!pool) {
    queue.items = queue.items.filter((item) => item.id !== itemId).map((item, index) => ({ ...item, position: index }));
    queue.updatedAt = now();
    return queue;
  }
  await pool.query("DELETE FROM queue_items WHERE id = $1 AND queue_id = $2", [itemId, queueId]);
  const remaining = (await queueItems(queueId)).map((item) => item.id);
  await reorderQueueItems(queueId, user, remaining);
  return findQueue(queueId, user);
}

function requestWithCounts(request: TrackRequest, user?: RequestUser): TrackRequest {
  const votes = memoryTrackRequestVotes.filter((vote) => vote.requestId === request.id);
  return {
    ...request,
    upvoteCount: votes.length,
    upvotedByCurrentUser: Boolean(user && votes.some((vote) => vote.userId === user.id))
  };
}

export async function listTrackRequests(user?: RequestUser) {
  await ensureDb();
  if (!pool) {
    return memoryTrackRequests
      .map((request) => requestWithCounts(request, user))
      .sort((a, b) => b.upvoteCount - a.upvoteCount || Date.parse(b.createdAt) - Date.parse(a.createdAt));
  }
  const result = await pool.query(
    `SELECT tr.*,
      COUNT(trv.user_id)::text AS upvote_count,
      BOOL_OR(trv.user_id = $1) AS upvoted_by_current_user
     FROM track_requests tr
     LEFT JOIN track_request_votes trv ON trv.request_id = tr.id
     GROUP BY tr.id
     ORDER BY COUNT(trv.user_id) DESC, tr.created_at DESC`,
    [user?.id ?? ""]
  );
  return result.rows.map((row) => rowToTrackRequest(row, Number(row.upvote_count), Boolean(row.upvoted_by_current_user)));
}

export async function createTrackRequest(user: RequestUser, input: {
  title?: string;
  trackId?: string;
  reciterName?: string;
  writerName?: string;
  notes?: string;
}) {
  if (!canUseCommunity(user)) return undefined;
  const track = input.trackId ? findTrack(input.trackId) : undefined;
  if (input.trackId && !track) return undefined;
  const timestamp = now();
  const request: TrackRequest = {
    id: slugId("track-request", input.title ?? track?.title ?? "track"),
    title: input.title ?? track?.title ?? "Requested track",
    trackId: input.trackId,
    reciterName: input.reciterName,
    writerName: input.writerName,
    notes: input.notes,
    requesterUserId: user.id,
    status: "open",
    upvoteCount: 0,
    upvotedByCurrentUser: false,
    createdAt: timestamp,
    updatedAt: timestamp
  };
  await ensureDb();
  if (!pool) {
    memoryTrackRequests.unshift(request);
    return request;
  }
  await pool.query(
    `INSERT INTO track_requests (id, title, track_id, reciter_name, writer_name, notes, requester_user_id, status, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      request.id,
      request.title,
      request.trackId ?? null,
      request.reciterName ?? null,
      request.writerName ?? null,
      request.notes ?? null,
      request.requesterUserId,
      request.status,
      request.createdAt,
      request.updatedAt
    ]
  );
  return request;
}

export async function updateTrackRequestStatus(id: string, user: RequestUser, status: TrackRequestStatus) {
  if (!isEditor(user)) return undefined;
  await ensureDb();
  if (!pool) {
    const request = memoryTrackRequests.find((item) => item.id === id);
    if (!request) return undefined;
    request.status = status;
    request.updatedAt = now();
    return requestWithCounts(request, user);
  }
  const result = await pool.query("UPDATE track_requests SET status = $1, updated_at = $2 WHERE id = $3 RETURNING *", [status, now(), id]);
  if (!result.rows[0]) return undefined;
  const requests = await listTrackRequests(user);
  return requests.find((request) => request.id === id);
}

export async function toggleTrackRequestUpvote(id: string, user: RequestUser) {
  if (!canUseCommunity(user)) return undefined;
  await ensureDb();
  if (!pool) {
    const request = memoryTrackRequests.find((item) => item.id === id);
    if (!request) return undefined;
    const index = memoryTrackRequestVotes.findIndex((vote) => vote.requestId === id && vote.userId === user.id);
    if (index >= 0) memoryTrackRequestVotes.splice(index, 1);
    else memoryTrackRequestVotes.push({ requestId: id, userId: user.id, createdAt: now() });
    return requestWithCounts(request, user);
  }
  const request = await pool.query("SELECT 1 FROM track_requests WHERE id = $1", [id]);
  if (!request.rowCount) return undefined;
  const existing = await pool.query("SELECT 1 FROM track_request_votes WHERE request_id = $1 AND user_id = $2", [id, user.id]);
  if (existing.rowCount) {
    await pool.query("DELETE FROM track_request_votes WHERE request_id = $1 AND user_id = $2", [id, user.id]);
  } else {
    await pool.query("INSERT INTO track_request_votes (request_id, user_id, created_at) VALUES ($1, $2, $3)", [id, user.id, now()]);
  }
  const requests = await listTrackRequests(user);
  return requests.find((item) => item.id === id);
}

async function verificationsForSubmissionIds(submissionIds: string[]) {
  await ensureDb();
  if (!pool) return memorySubmissionVerifications.filter((verification) => submissionIds.includes(verification.submissionId));
  if (!submissionIds.length) return [];
  const result = await pool.query("SELECT * FROM submission_verifications WHERE submission_id = ANY($1)", [submissionIds]);
  return result.rows.map(rowToSubmissionVerification);
}

async function augmentSubmissions(submissions: Submission[], user?: RequestUser) {
  const verifications = await verificationsForSubmissionIds(submissions.map((submission) => submission.id));
  return submissions.map((submission) => {
    const summary = emptyVerificationSummary();
    const currentUserVerifications: Submission["currentUserVerifications"] = {};
    for (const verification of verifications.filter((item) => item.submissionId === submission.id)) {
      summary[verification.field][verification.vote] += 1;
      if (user && verification.verifierUserId === user.id) {
        currentUserVerifications[verification.field] = verification;
      }
    }
    return {
      ...submission,
      verificationSummary: summary,
      currentUserVerifications
    };
  });
}

export async function listSubmissions(user?: RequestUser) {
  return augmentSubmissions(snapshot.submissions, user);
}

export function findSubmission(id: string) {
  return snapshot.submissions.find((submission) => submission.id === id);
}

export async function findSubmissionWithVerification(id: string, user?: RequestUser) {
  const submission = findSubmission(id);
  if (!submission) return undefined;
  return (await augmentSubmissions([submission], user))[0];
}

export async function listCommunitySubmissions(user: RequestUser) {
  if (!canUseCommunity(user)) return undefined;
  const allowedStatuses: SubmissionStatus[] = ["submitted", "under_review", "changes_requested", "approved"];
  return augmentSubmissions(snapshot.submissions.filter((submission) => allowedStatuses.includes(submission.moderationStatus)), user);
}

export async function upsertSubmissionVerification(user: RequestUser, submissionId: string, input: {
  field: SubmissionVerificationField;
  vote: SubmissionVerificationVote;
  note?: string;
}) {
  if (!canUseCommunity(user) || !findSubmission(submissionId)) return undefined;
  await ensureDb();
  const timestamp = now();
  if (!pool) {
    const existing = memorySubmissionVerifications.find(
      (verification) => verification.submissionId === submissionId && verification.verifierUserId === user.id && verification.field === input.field
    );
    if (existing) {
      existing.vote = input.vote;
      existing.note = input.note;
      existing.updatedAt = timestamp;
    } else {
      memorySubmissionVerifications.push({
        id: slugId("submission-verification", `${submissionId}-${input.field}`),
        submissionId,
        verifierUserId: user.id,
        field: input.field,
        vote: input.vote,
        note: input.note,
        createdAt: timestamp,
        updatedAt: timestamp
      });
    }
    return findSubmissionWithVerification(submissionId, user);
  }
  await pool.query(
    `INSERT INTO submission_verifications (id, submission_id, verifier_user_id, field, vote, note, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (submission_id, verifier_user_id, field) DO UPDATE SET
      vote = EXCLUDED.vote,
      note = EXCLUDED.note,
      updated_at = EXCLUDED.updated_at`,
    [slugId("submission-verification", `${submissionId}-${input.field}`), submissionId, user.id, input.field, input.vote, input.note ?? null, timestamp, timestamp]
  );
  return findSubmissionWithVerification(submissionId, user);
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
