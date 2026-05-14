const API_BASE_URL = (import.meta.env.VITE_DERVAISH_API_BASE_URL ?? "http://localhost:8000").replace(/\/$/, "");

export interface CollectionSummary {
  id: number;
  title: string;
  slug: string;
  visibility: string;
  is_curated: boolean;
  track_count: number;
}

export interface TrackCredit {
  id: number;
  role: string;
  person_name: string;
}

export interface TrackSummary {
  id: number;
  title: string;
  slug: string;
  visibility: string;
  duration_ms: number;
  primary_language_code: string;
  collection: CollectionSummary | null;
  credits: TrackCredit[];
}

export interface LyricLanguage {
  id: number;
  code: string;
  name: string;
  role: string;
  direction: "ltr" | "rtl";
  is_published: boolean;
}

export interface LyricSegment {
  id: number;
  start_ms: number;
  end_ms: number;
  text_by_language: Record<string, string>;
}

export interface PlaybackManifest {
  id: number;
  title: string;
  duration_ms: number;
  primary_language_code: string;
  preferred_asset: { id: number; title: string; kind: string; status: string } | null;
  renditions: Array<{ id: number; format: string; codec: string; playback_url: string; status: string; is_playable: boolean }>;
  captions: Array<{ id: number; language_code: string; label: string; url: string }>;
  chapters: Array<{ id: number; title: string; start_ms: number; end_ms: number | null }>;
  lyric_set: null | {
    id: number;
    version: number;
    languages: LyricLanguage[];
    segments: LyricSegment[];
  };
}

export interface ArchiveRecord {
  id: number;
  title: string;
  slug: string;
  summary: string;
  visibility: string;
  terms: Array<{ id: number; vocabulary: string; code: string; label: string }>;
  updated_at: string;
}

export interface Submission {
  id: number;
  title: string;
  voice: string;
  writer: string;
  source_name: string;
  status: string;
  submitter_name: string;
  verification_summary: Record<string, { verify: number; dispute: number }>;
}

export interface TrackRequest {
  id: number;
  title: string;
  reciter_name: string;
  writer_name: string;
  source_hint: string;
  status: string;
  requester_name: string;
  upvote_count: number;
}

export interface VideoGenerationJob {
  id: number;
  title: string;
  status: string;
  resolution: string;
  source_mode: string;
  failure_reason: string;
  published_at: string | null;
}

async function request<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }
  return response.json() as Promise<T>;
}

function list<T>(value: T[] | { results?: T[] }): T[] {
  return Array.isArray(value) ? value : value.results ?? [];
}

export const api = {
  baseUrl: API_BASE_URL,
  async tracks() {
    return list(await request<TrackSummary[] | { results?: TrackSummary[] }>("/api/catalog/tracks/"));
  },
  playback(trackId: number) {
    return request<PlaybackManifest>(`/api/catalog/tracks/${trackId}/playback/`);
  },
  async archiveRecords() {
    return list(await request<ArchiveRecord[] | { results?: ArchiveRecord[] }>("/api/archive/records/"));
  },
  async submissions() {
    return list(await request<Submission[] | { results?: Submission[] }>("/api/community/submissions/"));
  },
  async trackRequests() {
    return list(await request<TrackRequest[] | { results?: TrackRequest[] }>("/api/community/track-requests/"));
  },
  async videoJobs() {
    return list(await request<VideoGenerationJob[] | { results?: VideoGenerationJob[] }>("/api/video-generation/jobs/"));
  },
};
