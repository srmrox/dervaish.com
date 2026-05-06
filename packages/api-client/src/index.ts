import type {
  ArchiveRecord,
  CatalogSnapshot,
  LyricLanguage,
  LyricSegment,
  MediaAsset,
  OfflinePackage,
  SearchResult,
  Submission,
  SubmissionMedia,
  SubmissionStatus,
  Track,
  Video,
  VideoGenerationJob
} from "@dervaish/domain";

async function request<T>(baseUrl: string, path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      "Content-Type": "application/json",
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

  getCatalog() {
    return request<CatalogSnapshot>(this.baseUrl, "/catalog");
  }

  search(query: string) {
    return request<SearchResult>(this.baseUrl, `/catalog/search?q=${encodeURIComponent(query)}`);
  }

  getTrack(id: string) {
    return request<Track>(this.baseUrl, `/catalog/tracks/${id}`);
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

  createSubmission(input: {
    submitterId: string;
    title: string;
    voice?: string;
    writer?: string;
    notes?: string;
    sourceName?: string;
  }) {
    return request<Submission>(this.baseUrl, "/submissions", {
      method: "POST",
      body: JSON.stringify(input)
    });
  }

  updateSubmission(id: string, input: Partial<Pick<Submission, "title" | "voice" | "writer" | "notes" | "sourceName" | "moderationStatus">>) {
    return request<Submission>(this.baseUrl, `/submissions/${id}`, {
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
    return request<{ submission: Submission; media: SubmissionMedia; asset: MediaAsset }>(this.baseUrl, `/submissions/${id}/media`, {
      method: "POST",
      body: JSON.stringify(input)
    });
  }

  addLyricLanguage(id: string, input: Omit<LyricLanguage, "id">) {
    return request<LyricLanguage>(this.baseUrl, `/submissions/${id}/lyrics/languages`, {
      method: "POST",
      body: JSON.stringify(input)
    });
  }

  replaceLyricSegments(id: string, segments: Array<Omit<LyricSegment, "id"> & { id?: string }>) {
    return request<Submission["lyricSet"]>(this.baseUrl, `/submissions/${id}/lyrics/segments`, {
      method: "PUT",
      body: JSON.stringify({ segments })
    });
  }

  submitSubmission(id: string) {
    return request<Submission>(this.baseUrl, `/submissions/${id}/submit`, { method: "POST" });
  }

  reviewSubmission(id: string, input: { status: Exclude<SubmissionStatus, "draft" | "submitted" | "published">; note?: string }) {
    return request<Submission>(this.baseUrl, `/submissions/${id}/review`, {
      method: "PATCH",
      body: JSON.stringify(input)
    });
  }

  publishSubmission(id: string) {
    return request<Submission>(this.baseUrl, `/submissions/${id}/publish`, { method: "POST" });
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
    return request<VideoGenerationJob>(this.baseUrl, "/video-generation/jobs", {
      method: "POST",
      body: JSON.stringify(input)
    });
  }

  getVideoGenerationJob(id: string) {
    return request<VideoGenerationJob>(this.baseUrl, `/video-generation/jobs/${id}`);
  }

  cancelVideoGenerationJob(id: string) {
    return request<VideoGenerationJob>(this.baseUrl, `/video-generation/jobs/${id}/cancel`, { method: "POST" });
  }
}
