// Domain types mirroring the Django DRF v1 serializers (master plan §7).

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
  container: string;
  bitrate_kbps: number | null;
  height: number | null;
  url: string;
  mirrors: MirrorUrl[];
  streaming: boolean;
  offline_download: boolean;
  source: boolean;
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
