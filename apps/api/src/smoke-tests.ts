process.env.DATABASE_URL = "";
export {};

const { default: Fastify } = await import("fastify");
const { registerRoutes } = await import("./routes.js");

const app = Fastify();
await registerRoutes(app);

const userHeaders = {
  "x-dervaish-user-id": "contributor-web",
  "x-dervaish-role": "contributor"
};
const anonymousHeaders = {
  "x-dervaish-user-id": "anonymous",
  "x-dervaish-role": "anonymous"
};

async function inject(method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE", url: string, payload?: unknown, headers = userHeaders) {
  const response = await (app.inject({
    method,
    url,
    payload: payload === undefined ? undefined : JSON.stringify(payload),
    headers: payload === undefined ? headers : { ...headers, "content-type": "application/json" }
  }) as unknown as Promise<{ statusCode: number; body: string; json: () => any }>);
  return response;
}

async function expectOk(method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE", url: string, payload?: unknown, expectedStatus = 200) {
  const response = await inject(method, url, payload);
  if (response.statusCode !== expectedStatus) {
    throw new Error(`${method} ${url} returned ${response.statusCode}: ${response.body}`);
  }
  return response.json();
}

const catalog = await expectOk("GET", "/catalog");
if ("releases" in catalog) throw new Error("catalog response must not expose releases");
if (!Array.isArray(catalog.collections) || !catalog.collections[0]?.isCurated) throw new Error("catalog must expose curated collections");
const importedTrack = catalog.tracks.find((item: { id: string }) => item.id === "track-tanam-farsooda");
if (!importedTrack) throw new Error("imported timed-lyrics track missing from catalog");
if (importedTrack.lyricSet.segments.length !== 10) throw new Error("imported timed subtitles were not converted into lyric segments");
if (!importedTrack.lyricSet.languages.some((language: { code: string; direction: string }) => language.code === "ur" && language.direction === "rtl")) {
  throw new Error("imported Urdu RTL language metadata missing");
}

const trackId = catalog.tracks[0].id;
const track = await expectOk("GET", `/catalog/tracks/${trackId}`);
if (!track.reciters?.length || !track.writers?.length) throw new Error("track response must include reciters and writers");
if (typeof track.upvoteCount !== "number") throw new Error("track response must include upvote count");
if (!track.mediaAssets[0].playbackUrl?.startsWith("https://raw.githubusercontent.com/")) throw new Error("GitHub blob media URL was not normalized");
if (!track.lyricSet.languages.some((language: { direction: string }) => language.direction === "rtl")) throw new Error("RTL language direction missing from track response");

const playback = await expectOk("GET", `/playback/tracks/${trackId}`);
if (!playback.audioUrl?.startsWith("https://raw.githubusercontent.com/")) throw new Error("playback response must include normalized audioUrl");
if (!playback.asset?.playbackUrl) throw new Error("playback response must include selected asset");
if (!Array.isArray(playback.mirrors)) throw new Error("playback response must include mirrors");

const preference = await expectOk("PUT", `/me/lyric-preferences/${trackId}`, { visibleLanguageIds: [track.lyricSet.languages[0].id] });
if (preference.visibleLanguageIds.length !== 1) throw new Error("lyric preference did not save selected languages");
const savedPreference = await expectOk("GET", `/me/lyric-preferences/${trackId}`);
if (savedPreference.visibleLanguageIds[0] !== track.lyricSet.languages[0].id) throw new Error("lyric preference did not reload");
const anonymousPreference = await inject("PUT", `/me/lyric-preferences/${trackId}`, { visibleLanguageIds: [track.lyricSet.languages[0].id] }, anonymousHeaders);
if (anonymousPreference.statusCode !== 403) throw new Error("anonymous lyric preference write should be rejected");

const video = await expectOk("GET", "/catalog/videos/video-river-session");
if (!video.videoUrl?.startsWith("https://raw.githubusercontent.com/")) throw new Error("video response must include raw GitHub videoUrl");

const collection = await expectOk("POST", "/collections", { title: "Smoke Collection", visibility: "private", trackIds: [trackId] }, 201);
await expectOk("PATCH", `/collections/${collection.id}`, { visibility: "public" });
const shared = await expectOk("POST", `/collections/${collection.id}/share-token`);
if (!shared.shareToken) throw new Error("share token was not generated");

const queue = await expectOk("POST", "/me/queues", { title: "Smoke Queue" }, 201);
const queued = await expectOk("POST", `/me/queues/${queue.id}/items`, { trackId });
if (queued.items.length !== 1) throw new Error("queue item was not added");
await expectOk("PATCH", `/me/queues/${queue.id}/items/reorder`, { itemIds: queued.items.map((item: { id: string }) => item.id) });
await expectOk("DELETE", `/me/queues/${queue.id}/items/${queued.items[0].id}`);

const invalidMedia = await inject("POST", "/submissions/submission-001/media", {
  role: "source_audio",
  originalFilename: "invalid.mp3",
  mimeType: "audio/mpeg",
  sizeBytes: 100,
  durationMs: 1000,
  sourceUrl: "file:///tmp/invalid.mp3"
});
if (invalidMedia.statusCode !== 400) throw new Error("non-http sourceUrl should be rejected");

const correction = await expectOk("POST", `/catalog/tracks/${trackId}/corrections`, {
  submitterId: "contributor-web",
  correctionFields: ["lyrics", "writer"],
  notes: "Correct the second lyric line."
}, 201);
if (correction.correctionForTrackId !== trackId || !correction.lyricSet.segments.length) throw new Error("correction submission was not linked and prefilled");

const adminHeaders = {
  "x-dervaish-user-id": "admin-web",
  "x-dervaish-role": "admin"
};
const libraryResponse = await inject("POST", "/admin/media-libraries", {
  title: "Smoke GitHub Mirror",
  kind: "github",
  baseUrl: "https://github.com/srmrox/dervaish-media"
}, adminHeaders);
if (libraryResponse.statusCode !== 201) throw new Error(`admin media library create failed: ${libraryResponse.body}`);
const library = libraryResponse.json();
const nonAdminLibrary = await inject("POST", "/admin/media-libraries", { title: "Blocked Library", kind: "external" });
if (nonAdminLibrary.statusCode !== 403) throw new Error("non-admin media library writes should be rejected");
const mirrorResponse = await inject("POST", "/admin/media-mirrors", {
  libraryId: library.id,
  trackId,
  kind: "audio",
  format: "mp3",
  sourceUrl: "https://github.com/srmrox/dervaish-media/blob/main/audio/sindh-river.mp3"
}, adminHeaders);
if (mirrorResponse.statusCode !== 201) throw new Error(`admin media mirror create failed: ${mirrorResponse.body}`);
const mirror = mirrorResponse.json();
if (!mirror.playbackUrl?.startsWith("https://raw.githubusercontent.com/")) throw new Error("GitHub mirror URL was not normalized");
const trackMirrors = await expectOk("GET", `/catalog/tracks/${trackId}/mirrors`);
if (!trackMirrors.every((item: { trackId: string }) => item.trackId === trackId)) throw new Error("track mirrors endpoint returned mirrors for another track");
const importedMirrors = await expectOk("GET", "/catalog/tracks/track-tanam-farsooda/mirrors");
if (!importedMirrors.some((item: { kind: string; playbackUrl?: string }) => item.kind === "audio" && item.playbackUrl === "/imported-media/tanam-farsooda-ja-para/audio.mp3")) {
  throw new Error("imported public media audio mirror missing");
}
if (!importedMirrors.some((item: { kind: string; playbackUrl?: string }) => item.kind === "image" && item.playbackUrl === "/imported-media/tanam-farsooda-ja-para/image.jpg")) {
  throw new Error("imported public media image mirror missing");
}
const storageMirrorResponse = await inject("POST", "/admin/media-mirrors", {
  libraryId: "library-imported-web-public",
  trackId: "track-tanam-farsooda",
  kind: "audio",
  format: "mp3",
  sourceUrl: "/imported-media/tanam-farsooda-ja-para/audio.mp3"
}, adminHeaders);
if (storageMirrorResponse.statusCode !== 201) throw new Error(`storage public-path mirror create failed: ${storageMirrorResponse.body}`);

const freeformRequest = await expectOk("POST", "/community/track-requests", { title: "Smoke missing track", reciterName: "Community reciter" }, 201);
const existingTrackRequest = await expectOk("POST", "/community/track-requests", { trackId, notes: "Please prioritize this catalog track." }, 201);
const upvotedRequest = await expectOk("POST", `/community/track-requests/${freeformRequest.id}/upvote`);
if (!upvotedRequest.upvotedByCurrentUser || upvotedRequest.upvoteCount !== 1) throw new Error("request upvote did not toggle on");
const rankedRequests = await expectOk("GET", "/community/track-requests");
if (rankedRequests[0].id !== freeformRequest.id) throw new Error("request queue is not sorted by upvotes");
const unvotedRequest = await expectOk("POST", `/community/track-requests/${freeformRequest.id}/upvote`);
if (unvotedRequest.upvotedByCurrentUser || unvotedRequest.upvoteCount !== 0) throw new Error("request upvote did not toggle off");
if (!existingTrackRequest.trackId) throw new Error("existing-track request did not preserve trackId");

const upvotedTrack = await expectOk("POST", `/catalog/tracks/${trackId}/upvote`);
if (!upvotedTrack.upvotedByCurrentUser || upvotedTrack.upvoteCount !== 1) throw new Error("track upvote did not toggle on");
const catalogAfterVote = await expectOk("GET", "/catalog");
if (catalogAfterVote.tracks[0].upvoteCount !== 1) throw new Error("catalog response did not include track upvote count");
await expectOk("POST", `/catalog/tracks/${trackId}/upvote`);

const anonymousVote = await inject("POST", `/catalog/tracks/${trackId}/upvote`, undefined, anonymousHeaders);
if (anonymousVote.statusCode !== 403) throw new Error("anonymous track upvote should be rejected");

const communitySubmissions = await expectOk("GET", "/community/submissions");
if (communitySubmissions.some((submission: { moderationStatus: string }) => ["draft", "rejected"].includes(submission.moderationStatus))) {
  throw new Error("community submissions include hidden moderation states");
}
const submissionId = communitySubmissions[0].id;
const verified = await expectOk("POST", `/community/submissions/${submissionId}/verifications`, { field: "writer", vote: "verify" });
if (verified.verificationSummary.writer.verify !== 1) throw new Error("verification summary did not count writer verify");
const disputed = await expectOk("POST", `/community/submissions/${submissionId}/verifications`, { field: "writer", vote: "dispute" });
if (disputed.verificationSummary.writer.verify !== 0 || disputed.verificationSummary.writer.dispute !== 1) {
  throw new Error("verification upsert did not replace current user's field vote");
}
const adminSubmission = await expectOk("GET", `/submissions/${submissionId}`);
if (adminSubmission.verificationSummary.writer.dispute !== 1) throw new Error("admin submission response lacks verification summary");

const anonymousVerification = await inject("POST", `/community/submissions/${submissionId}/verifications`, { field: "overall", vote: "verify" }, anonymousHeaders);
if (anonymousVerification.statusCode !== 403) throw new Error("anonymous verification should be rejected");

await app.close();
console.log("API smoke tests passed");
