// Domain types mirroring the Django DRF v1 serializers (backend/ Kalam/Verse model).

export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface KalamListItem {
  slug: string;
  title: string;
  title_native: string;
  title_transliterated: string;
  author_name: string | null;
  genre: string | null;
}

export interface Verse {
  order: number;
  text_native: string;
  transliteration: string;
  translations: Record<string, string>;
  meaning: Record<string, string>;
  start_ms: number | null;
  end_ms: number | null;
}

export interface Credit {
  role: string;
  person_name: string;
  person_slug: string;
  display_order: number;
  note: string;
}

export interface MirrorUrl {
  mirror: string;
  name: string;
  kind: string;
  url: string;
  default_enabled: boolean;
  priority: number;
}

export interface PlaybackVariant {
  kind: string;
  storage_key: string;
  container: string;
  bitrate_kbps: number | null;
  height: number | null;
  url: string;
  mirrors: MirrorUrl[];
  streaming: boolean;
  offline_download: boolean;
  source: boolean;
}

export interface MirrorInfo {
  slug: string;
  name: string;
  base_url: string;
  kind: string;
  is_official: boolean;
  is_active: boolean;
  is_default_enabled: boolean;
  verified: boolean;
  carries_all: boolean;
  priority: number;
}

export interface PlaybackManifest {
  protection_level: string;
  variants: PlaybackVariant[];
}

export interface Rendition {
  slug: string;
  title: string;
  duration_ms: number;
  year: number | null;
  album: string;
  publisher: string;
  style: string;
  protection_level: string;
  rights_note: string;
  credits: Credit[];
  playback: PlaybackManifest;
}

export interface PersonRef {
  slug: string;
  name: string;
  name_native: string;
  era: string;
  region: string;
}

export interface KalamDetail {
  slug: string;
  title: string;
  title_native: string;
  title_transliterated: string;
  summary: string;
  author: PersonRef | null;
  primary_language: string | null;
  genre: string | null;
  tradition: string | null;
  era: string;
  themes: string[];
  tags: string[];
  verses: Verse[];
  credits: Credit[];
  renditions: Rendition[];
}

export interface PersonDetail extends PersonRef {
  aliases: string[];
  biography: string;
  tradition: string | null;
  external_ids: Record<string, string>;
  authored_kalams: KalamListItem[];
}

export interface RenditionRef {
  slug: string;
  title: string;
  kalam_slug: string;
  kalam_title: string;
  duration_ms: number;
  has_media: boolean;
}

export interface Collection {
  slug: string;
  title: string;
  description: string;
  is_curated: boolean;
  rendition_count: number;
}

export interface SearchResults {
  kalams: KalamListItem[];
  people: PersonRef[];
  renditions: RenditionRef[];
  collections: Collection[];
}

export interface Me {
  id: number;
  username: string;
  display_name: string;
  role: "anonymous" | "listener" | "contributor" | "editor" | "admin";
  trust_score: number;
}

export interface LibraryItem {
  rendition_detail: RenditionRef;
  created_at: string;
}

export interface QueueItem {
  rendition_detail: RenditionRef;
  position: number;
}

export type SubmissionKind =
  | "source"
  | "transcription"
  | "timing"
  | "translation"
  | "context";

export interface Submission {
  id: number;
  title: string;
  payload: Record<string, unknown> & { kind?: SubmissionKind };
  status: string;
  reviewer_note: string;
  author_name: string;
  created_at: string;
  updated_at: string;
}

export interface KalamRequest {
  id: number;
  title: string;
  details: string;
  author_hint: string;
  reciter_hint: string;
  status: "open" | "planned" | "fulfilled" | "rejected";
  upvotes: number;
  has_upvoted: boolean;
  created_at: string;
}

export interface RenderJob {
  id: number;
  rendition: number | null;
  rendition_slug: string | null;
  source_mode: "audio_visualizer" | "video_overlay";
  layout_id: string;
  resolution: string;
  visible_language_codes: string[];
  title: string;
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  output_url: string;
  failure_reason: string;
  created_at: string;
}

export interface PublishedFile {
  id: number;
  entity_type: string;
  entity_id: string;
  repo_path: string;
  content_hash: string;
  commit_sha: string;
  status: "pending" | "committed" | "failed";
  published_at: string | null;
  created_at: string;
}
