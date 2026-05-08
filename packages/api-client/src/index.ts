import type {
  ArchiveRecord,
  CatalogSnapshot,
  Collection,
  LyricLanguage,
  LyricSegment,
  MediaAsset,
  OfflinePackage,
  Person,
  SearchResult,
  Submission,
  SubmissionVerificationField,
  SubmissionVerificationVote,
  SubmissionMedia,
  SubmissionStatus,
  Track,
  TrackRequest,
  TrackRequestStatus,
  UserQueue,
  UserRole,
  Video,
  VideoGenerationJob
} from "@dervaish/domain";

export interface DervaishClientUser {
  id: string;
  role: UserRole;
}

async function request<T>(baseUrl: string, path: string, user?: DervaishClientUser, init?: RequestInit): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(user ? { "X-Dervaish-User-Id": user.id, "X-Dervaish-Role": user.role } : {}),
      ...(init?.headers ?? {})
    },
    ...init
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

export class DervaishApiClient {
  constructor(private readonly baseUrl: string) {}

  getCatalog(user?: DervaishClientUser) {
    return request<CatalogSnapshot>(this.baseUrl, "/catalog", user);
  }

  search(query: string, user?: DervaishClientUser) {
    return request<SearchResult>(this.baseUrl, `/catalog/search?q=${encodeURIComponent(query)}`, user);
  }

  getCollection(id: string, user?: DervaishClientUser, shareToken?: string) {
    const query = shareToken ? `?share=${encodeURIComponent(shareToken)}` : "";
    return request<Collection>(this.baseUrl, `/catalog/collections/${id}${query}`, user);
  }

  listCollections(user?: DervaishClientUser) {
    return request<Collection[]>(this.baseUrl, "/catalog/collections", user);
  }

  getTrack(id: string, user?: DervaishClientUser) {
    return request<Track & { reciters?: Person[]; writers?: Person[] }>(this.baseUrl, `/catalog/tracks/${id}`, user);
  }

  toggleTrackUpvote(user: DervaishClientUser, id: string) {
    return request<Track>(this.baseUrl, `/catalog/tracks/${id}/upvote`, user, { method: "POST" });
  }

  getPerson(id: string, user?: DervaishClientUser) {
    return request<Person & { tracks: Track[] }>(this.baseUrl, `/catalog/people/${id}`, user);
  }

  getVideo(id: string) {
    return request<Video>(this.baseUrl, `/catalog/videos/${id}`);
  }

  getArchiveRecord(id: string) {
    return request<ArchiveRecord>(this.baseUrl, `/archive/records/${id}`);
  }

  getOfflinePackages() {
    return request<OfflinePackage[]>(this.baseUrl, "/offline/packages");
  }

  listSubmissions() {
    return request<Submission[]>(this.baseUrl, "/submissions");
  }

  getSubmission(id: string) {
    return request<Submission>(this.baseUrl, `/submissions/${id}`);
  }

  createCollection(user: DervaishClientUser, input: {
    title: string;
    visibility?: Collection["visibility"];
    artworkUrl?: string;
    year?: number;
    trackIds?: string[];
  }) {
    return request<Collection>(this.baseUrl, "/collections", user, {
      method: "POST",
      body: JSON.stringify(input)
    });
  }

  updateCollection(user: DervaishClientUser, id: string, input: Partial<Pick<Collection, "title" | "visibility" | "artworkUrl" | "year" | "trackIds">>) {
    return request<Collection>(this.baseUrl, `/collections/${id}`, user, {
      method: "PATCH",
      body: JSON.stringify(input)
    });
  }

  addCollectionTrack(user: DervaishClientUser, id: string, trackId: string) {
    return request<Collection>(this.baseUrl, `/collections/${id}/tracks`, user, {
      method: "POST",
      body: JSON.stringify({ trackId })
    });
  }

  removeCollectionTrack(user: DervaishClientUser, id: string, trackId: string) {
    return request<Collection>(this.baseUrl, `/collections/${id}/tracks/${trackId}`, user, { method: "DELETE" });
  }

  createCollectionShareToken(user: DervaishClientUser, id: string) {
    return request<Collection>(this.baseUrl, `/collections/${id}/share-token`, user, { method: "POST" });
  }

  listQueues(user: DervaishClientUser) {
    return request<UserQueue[]>(this.baseUrl, "/me/queues", user);
  }

  createQueue(user: DervaishClientUser, input: { title: string }) {
    return request<UserQueue>(this.baseUrl, "/me/queues", user, {
      method: "POST",
      body: JSON.stringify(input)
    });
  }

  getQueue(user: DervaishClientUser, id: string) {
    return request<UserQueue>(this.baseUrl, `/me/queues/${id}`, user);
  }

  addQueueItem(user: DervaishClientUser, id: string, trackId: string) {
    return request<UserQueue>(this.baseUrl, `/me/queues/${id}/items`, user, {
      method: "POST",
      body: JSON.stringify({ trackId })
    });
  }

  reorderQueueItems(user: DervaishClientUser, id: string, itemIds: string[]) {
    return request<UserQueue>(this.baseUrl, `/me/queues/${id}/items/reorder`, user, {
      method: "PATCH",
      body: JSON.stringify({ itemIds })
    });
  }

  removeQueueItem(user: DervaishClientUser, id: string, itemId: string) {
    return request<UserQueue>(this.baseUrl, `/me/queues/${id}/items/${itemId}`, user, { method: "DELETE" });
  }

  listTrackRequests(user?: DervaishClientUser) {
    return request<TrackRequest[]>(this.baseUrl, "/community/track-requests", user);
  }

  createTrackRequest(user: DervaishClientUser, input: {
    title?: string;
    trackId?: string;
    reciterName?: string;
    writerName?: string;
    notes?: string;
  }) {
    return request<TrackRequest>(this.baseUrl, "/community/track-requests", user, {
      method: "POST",
      body: JSON.stringify(input)
    });
  }

  updateTrackRequestStatus(user: DervaishClientUser, id: string, status: TrackRequestStatus) {
    return request<TrackRequest>(this.baseUrl, `/community/track-requests/${id}`, user, {
      method: "PATCH",
      body: JSON.stringify({ status })
    });
  }

  toggleTrackRequestUpvote(user: DervaishClientUser, id: string) {
    return request<TrackRequest>(this.baseUrl, `/community/track-requests/${id}/upvote`, user, { method: "POST" });
  }

  listCommunitySubmissions(user: DervaishClientUser) {
    return request<Submission[]>(this.baseUrl, "/community/submissions", user);
  }

  getCommunitySubmission(user: DervaishClientUser, id: string) {
    return request<Submission>(this.baseUrl, `/community/submissions/${id}`, user);
  }

  verifySubmission(user: DervaishClientUser, id: string, input: {
    field: SubmissionVerificationField;
    vote: SubmissionVerificationVote;
    note?: string;
  }) {
    return request<Submission>(this.baseUrl, `/community/submissions/${id}/verifications`, user, {
      method: "POST",
      body: JSON.stringify(input)
    });
  }

  createSubmission(input: {
    submitterId: string;
    title: string;
    voice?: string;
    writer?: string;
    notes?: string;
    sourceName?: string;
  }) {
    return request<Submission>(this.baseUrl, "/submissions", undefined, {
      method: "POST",
      body: JSON.stringify(input)
    });
  }

  updateSubmission(id: string, input: Partial<Pick<Submission, "title" | "voice" | "writer" | "notes" | "sourceName" | "moderationStatus">>) {
    return request<Submission>(this.baseUrl, `/submissions/${id}`, undefined, {
      method: "PATCH",
      body: JSON.stringify(input)
    });
  }

  addSubmissionMedia(id: string, input: {
    role: SubmissionMedia["role"];
    originalFilename: string;
    mimeType: string;
    sizeBytes: number;
    durationMs?: number;
    checksumSha256?: string;
    storageKey?: string;
    width?: number;
    height?: number;
  }) {
    return request<{ submission: Submission; media: SubmissionMedia; asset: MediaAsset }>(this.baseUrl, `/submissions/${id}/media`, undefined, {
      method: "POST",
      body: JSON.stringify(input)
    });
  }

  addLyricLanguage(id: string, input: Omit<LyricLanguage, "id">) {
    return request<LyricLanguage>(this.baseUrl, `/submissions/${id}/lyrics/languages`, undefined, {
      method: "POST",
      body: JSON.stringify(input)
    });
  }

  replaceLyricSegments(id: string, segments: Array<Omit<LyricSegment, "id"> & { id?: string }>) {
    return request<Submission["lyricSet"]>(this.baseUrl, `/submissions/${id}/lyrics/segments`, undefined, {
      method: "PUT",
      body: JSON.stringify({ segments })
    });
  }

  submitSubmission(id: string) {
    return request<Submission>(this.baseUrl, `/submissions/${id}/submit`, undefined, { method: "POST" });
  }

  reviewSubmission(id: string, input: { status: Exclude<SubmissionStatus, "draft" | "submitted" | "published">; note?: string }) {
    return request<Submission>(this.baseUrl, `/submissions/${id}/review`, undefined, {
      method: "PATCH",
      body: JSON.stringify(input)
    });
  }

  publishSubmission(id: string) {
    return request<Submission>(this.baseUrl, `/submissions/${id}/publish`, undefined, { method: "POST" });
  }

  createVideoGenerationJob(input: {
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
    imageAssetIds?: string[];
  }) {
    return request<VideoGenerationJob>(this.baseUrl, "/video-generation/jobs", undefined, {
      method: "POST",
      body: JSON.stringify(input)
    });
  }

  getVideoGenerationJob(id: string) {
    return request<VideoGenerationJob>(this.baseUrl, `/video-generation/jobs/${id}`);
  }

  cancelVideoGenerationJob(id: string) {
    return request<VideoGenerationJob>(this.baseUrl, `/video-generation/jobs/${id}/cancel`, undefined, { method: "POST" });
  }
}
