// Seed (Stage 3) — seed_demo + seed_local_media, ported from the archived Django
// management commands (docs/node/seeding.md). Deterministic: wipes content and
// rebuilds it in one transaction so re-running gives the same catalogue. Uses the
// real bundled sample (mediafiles/samples/tanam-farsooda) for the one playable,
// public rendition credited to its reciter.
import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { db } from "./db.js";
import { env } from "./env.js";
import { hashPassword } from "./auth.js";

const now = () => new Date().toISOString();
const LOCAL_MODE = (process.env.DERVAISH_LOCAL_MODE ?? "true").toLowerCase() === "true";
const LOCAL_BASE = process.env.LOCAL_MEDIA_BASE_URL ?? "/media/";

function insert(sql: string, ...params: unknown[]): number {
  return Number(db.prepare(sql).run(...(params as never[])).lastInsertRowid);
}

function run(sql: string, ...params: unknown[]): void {
  db.prepare(sql).run(...(params as never[]));
}

function safeStatSize(abs: string): number | null {
  try {
    return statSync(abs).size;
  } catch {
    return null;
  }
}

console.log("[seed] rebuilding demo catalogue…");
db.exec("PRAGMA foreign_keys = ON;");
db.exec("BEGIN");
try {
  // ---- wipe (children first) ----
  for (const t of [
    "request_upvote", "kalam_request", "submission", "published_file", "video_generation_job",
    "queue_item", "queue", "saved_item", "collection_item", "collection",
    "media_asset_mirror", "media_variant", "rendition_asset", "credit", "verse", "kalam_theme",
    "rendition", "kalam", "person", "media_asset", "media_mirror", "content_source",
    "vocabulary_term", "auth_token", "user",
  ]) {
    db.exec(`DELETE FROM ${t};`);
  }

  // ---- taxonomy ----
  const term = (kind: string, label: string, slug: string) =>
    insert("INSERT INTO vocabulary_term (kind,label,slug) VALUES (?,?,?)", kind, label, slug);
  const langPersian = term("language", "Persian", "persian");
  term("language", "Urdu", "urdu");
  term("language", "Arabic", "arabic");
  const genreNaat = term("genre", "Naat", "naat");
  term("genre", "Hamd", "hamd");
  const genreGhazal = term("genre", "Ghazal", "ghazal");
  const tradChishti = term("tradition", "Chishti", "chishti");
  const tradNaqsh = term("tradition", "Naqshbandi", "naqshbandi");
  const themeLonging = term("theme", "longing", "longing");
  const themeDevotion = term("theme", "devotion", "devotion");
  const themeRepentance = term("theme", "repentance", "repentance");

  // ---- users ----
  const mkUser = (username: string, role: string, display: string, trust: number, pw: string) =>
    insert(
      "INSERT INTO user (username,role,display_name,trust_score,password_hash,preferences) VALUES (?,?,?,?,?,?)",
      username, role, display, trust, hashPassword(pw), JSON.stringify({ languages: ["fa", "en"] }),
    );
  const uContributor = mkUser("contributor", "contributor", "Demo Contributor", 62, "contrib123");
  mkUser("listener", "listener", "Demo Listener", 8, "listen123");
  const uEditor = mkUser("editor", "editor", "Demo Editor", 91, "edit123");
  mkUser("admin", "admin", "Demo Admin", 100, "admin123");
  // a small crowd so community upvote counts look real
  const crowd: number[] = [];
  for (let i = 1; i <= 8; i++) crowd.push(mkUser(`member-${i}`, "listener", `Member ${i}`, 5, `member${i}pw`));

  // ---- people ----
  const person = (
    slug: string, name: string, name_native: string, era: string, region: string,
    bio: string, aliases: string[], tradition_id: number | null,
  ) =>
    insert(
      `INSERT INTO person (slug,name,name_native,aliases,biography,era,region,tradition_id,visibility,state,external_ids)
       VALUES (?,?,?,?,?,?,?,?, 'public','published','{}')`,
      slug, name, name_native, JSON.stringify(aliases), bio, era, region, tradition_id,
    );
  const pJami = person(
    "jami", "Maulana Abdur Rahman Jami", "مولانا عبد الرحمٰن جامی", "15th century", "Herat",
    "Fifteenth-century Persian poet and scholar of the Naqshbandi order. The couplet Tanam Farsooda Jaan Para is among the most widely recited expressions of longing for the Prophet ﷺ.",
    ["Jami", "جامی"], tradNaqsh,
  );
  const pZulfikar = person(
    "zulfikar-ali", "Zulfikar Ali", "ذوالفقار علی", "Contemporary", "South Asia",
    "Reciter of Naat and Sufi kalam.", ["Z. Ali"], tradChishti,
  );
  const pSabri = person(
    "sabri-ensemble", "Sabri Ensemble", "", "Contemporary", "South Asia",
    "Qawwali ensemble in the Chishti tradition.", ["Sabri"], tradChishti,
  );

  // ---- kalams ----
  const kalam = (
    slug: string, title: string, title_native: string, title_translit: string, summary: string,
    author_id: number, language_id: number, genre_id: number, tradition_id: number, era: string,
    tags: string[], visibility = "public",
  ) =>
    insert(
      `INSERT INTO kalam (slug,title,title_native,title_transliterated,summary,author_id,primary_language_id,genre_id,tradition_id,era,tags,visibility,state,published_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?, 'published', ?)`,
      slug, title, title_native, title_translit, summary, author_id, language_id, genre_id, tradition_id, era,
      JSON.stringify(tags), visibility, now(),
    );
  const kTanam = kalam(
    "tanam-farsooda", "Tanam Farsooda Jaan Para", "تنم فرسودہ جاں پارہ", "Tanam Farsooda Jaan Para",
    "A Persian couplet of longing (firaq) for the Prophet ﷺ, traditionally attributed to Maulana Abdur Rahman Jami. It is recited across South Asia and the Persianate world, often as the closing of a Naat gathering.",
    pJami, langPersian, genreNaat, tradNaqsh, "15th century", ["firaq", "naat", "jami"],
  );
  const kAarzoo = kalam(
    "aarzoo", "Aarzoo", "آرزو", "Aarzoo",
    "A ghazal of yearning in the Persianate devotional tradition.",
    pJami, langPersian, genreGhazal, tradChishti, "Classical", ["ghazal", "yearning"],
  );

  // themes
  for (const t of [themeLonging, themeDevotion, themeRepentance])
    run("INSERT INTO kalam_theme (kalam_id,term_id) VALUES (?,?)", kTanam, t);
  run("INSERT INTO kalam_theme (kalam_id,term_id) VALUES (?,?)", kAarzoo, themeLonging);

  // ---- verses (from the bundled lyrics.json: [native, en, ur, translit] + timing) ----
  // Kept in time order (refrains included) so the Companion can highlight the
  // active cue as playback advances — each verse carries its start/end in ms.
  const lyricsPath = resolve(env.MEDIA_ROOT_ABS, "samples/tanam-farsooda/lyrics.json");
  let cues: { native: string; en: string; ur: string; translit: string; start: number; end: number }[] = [];
  try {
    const raw = JSON.parse(readFileSync(lyricsPath, "utf8")) as {
      lyrics: { lyric: string[]; start: number; end: number }[];
    };
    cues = raw.lyrics
      .map((l) => ({
        native: l.lyric[0] ?? "", en: l.lyric[1] ?? "", ur: l.lyric[2] ?? "", translit: l.lyric[3] ?? "",
        start: Math.round((l.start ?? 0) * 1000), end: Math.round((l.end ?? 0) * 1000),
      }))
      // drop the short "…" teaser cues; keep the timed verses
      .filter((v) => !v.native.includes("…") && v.native.replace(/\s/g, "").length > 6);
  } catch (e) {
    console.warn("[seed] lyrics.json not read:", (e as Error).message);
  }
  let order = 0;
  for (const v of cues) {
    run(
      `INSERT INTO verse (kalam_id,"order",text_native,transliteration,translations,meaning,start_ms,end_ms) VALUES (?,?,?,?,?,?,?,?)`,
      kTanam, order++, v.native, v.translit,
      JSON.stringify({ en: v.en, ur: v.ur }), JSON.stringify({ en: v.en }), v.start, v.end,
    );
  }

  // ---- mirrors ----
  const mirror = (
    slug: string, name: string, base_url: string, kind: string,
    opts: Partial<{ official: number; active: number; def: number; verified: number; carries: number; priority: number }>,
  ) =>
    insert(
      `INSERT INTO media_mirror (slug,name,base_url,kind,is_official,is_active,is_default_enabled,verified,carries_all,priority)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      slug, name, base_url, kind,
      opts.official ?? 0, opts.active ?? 1, opts.def ?? 1, opts.verified ?? 0, opts.carries ?? 0, opts.priority ?? 100,
    );
  const mLocal = mirror("local", "This device (local)", LOCAL_BASE, "local", {
    official: 0, active: 1, def: 1, verified: 1, carries: LOCAL_MODE ? 1 : 0, priority: 0,
  });
  mirror("dervaish-r2", "Dervaish (official mirror)", "https://media.dervaish.com/", "r2", {
    official: 1, active: 1, def: 1, verified: 1, carries: 1, priority: 10,
  });
  mirror("github-media", "GitHub (dervaish-media)", "https://raw.githubusercontent.com/srmrox/dervaish-media/main/", "github", {
    official: 1, active: 1, def: 0, verified: 1, carries: 0, priority: 20,
  });

  // content sources (federation directory)
  run(
    `INSERT INTO content_source (slug,name,base_url,kind,is_official,is_default,is_enabled,verified,priority)
     VALUES ('dervaish-official','Dervaish (official)','https://dervaish.com/','official',1,1,1,1,10)`,
  );

  // ---- media assets from disk ----
  const SAMPLES = "samples/tanam-farsooda";
  type AssetSpec = { file: string; kind: "audio" | "video"; container: string; mime: string; height: number | null; offline: number };
  const specs: AssetSpec[] = [
    { file: "audio.mp3", kind: "audio", container: "mp3", mime: "audio/mpeg", height: null, offline: 1 },
    { file: "landscape-1080p.mp4", kind: "video", container: "mp4", mime: "video/mp4", height: 1080, offline: 0 },
    { file: "portrait-1080p.mp4", kind: "video", container: "mp4", mime: "video/mp4", height: 1080, offline: 0 },
  ];
  const assetIds: number[] = [];
  for (const s of specs) {
    const storageKey = `${SAMPLES}/${s.file}`;
    const size = safeStatSize(resolve(env.MEDIA_ROOT_ABS, storageKey));
    if (size === null) {
      console.warn(`[seed] sample missing, skipping: ${storageKey}`);
      continue;
    }
    const assetId = insert(
      `INSERT INTO media_asset (storage_key,kind,mime_type,original_filename,size_bytes,processing_status,source_name,height)
       VALUES (?,?,?,?,?, 'ready','local sample', ?)`,
      storageKey, s.kind, s.mime, s.file, size, s.height,
    );
    assetIds.push(assetId);
    insert(
      `INSERT INTO media_variant (asset_id,storage_key,container,url,bitrate_kbps,height,is_streaming,is_offline_download)
       VALUES (?,?,?,?,?,?,1,?)`,
      assetId, storageKey, s.container, "", null, s.height, s.offline,
    );
    run("INSERT INTO media_asset_mirror (asset_id,mirror_id,available) VALUES (?,?,1)", assetId, mLocal);
  }

  // ---- rendition (one clean public rendition of Tanam, credited to the reciter) ----
  const rTanam = insert(
    `INSERT INTO rendition (slug,kalam_id,title,duration_ms,year,album,publisher,style,protection_level,rights_note,visibility,state,published_at)
     VALUES (?,?,?,?,?,?,?,?, 'open','', 'public','published', ?)`,
    "tanam-farsooda-local", kTanam, "Tanam Farsooda Jaan Para", 366000, 2019, "", "", "Naat", now(),
  );
  for (const a of assetIds) run("INSERT INTO rendition_asset (rendition_id,asset_id) VALUES (?,?)", rTanam, a);

  // a second, audio-only rendition (Sabri) with no attached media -> partial
  const rSabri = insert(
    `INSERT INTO rendition (slug,kalam_id,title,duration_ms,visibility,state,published_at,protection_level,style)
     VALUES (?,?,?,?, 'public','published', ?, 'open','Qawwali')`,
    "tanam-farsooda-sabri", kTanam, "Tanam Farsooda Jaan Para", 363000, now(),
  );

  // credits: author on kalam, reciter on renditions
  run("INSERT INTO credit (person_id,role,kalam_id,display_order,note) VALUES (?, 'author', ?, 0, '')", pJami, kTanam);
  run("INSERT INTO credit (person_id,role,kalam_id,display_order,note) VALUES (?, 'author', ?, 0, '')", pJami, kAarzoo);
  run("INSERT INTO credit (person_id,role,rendition_id,display_order,note) VALUES (?, 'reciter', ?, 0, '')", pZulfikar, rTanam);
  run("INSERT INTO credit (person_id,role,rendition_id,display_order,note) VALUES (?, 'reciter', ?, 0, '')", pSabri, rSabri);

  // ---- collections ----
  const collection = (slug: string, title: string, desc: string, curated: number, owner: number | null, vis: string) =>
    insert(
      "INSERT INTO collection (slug,title,description,is_curated,owner_id,visibility,state) VALUES (?,?,?,?,?,?, 'published')",
      slug, title, desc, curated, owner, vis,
    );
  const cNaat = collection("naat-essentials", "Naat & Hamd — Essentials", "A curated entry point to devotional recitation.", 1, null, "public");
  const cSufi = collection("sufi-kalam", "Sufi Kalam of the Persianate World", "Longing, devotion, and repentance across the tradition.", 1, null, "public");
  const cMine = collection("late-evenings", "For late evenings", "A personal listening set.", 0, uContributor, "unlisted");
  for (const [c, pos, rid] of [[cNaat, 0, rTanam], [cNaat, 1, rSabri], [cSufi, 0, rTanam], [cMine, 0, rSabri]] as const)
    run("INSERT INTO collection_item (collection_id,rendition_id,position) VALUES (?,?,?)", c, rid, pos);

  // ---- library + queue for the contributor ----
  run("INSERT INTO saved_item (user_id,rendition_id) VALUES (?,?)", uContributor, rTanam);
  const q1 = insert("INSERT INTO queue (user_id,name) VALUES (?, 'Morning recitation')", uContributor);
  run("INSERT INTO queue_item (queue_id,rendition_id,position) VALUES (?,?,0)", q1, rTanam);
  run("INSERT INTO queue_item (queue_id,rendition_id,position) VALUES (?,?,1)", q1, rSabri);

  // ---- community requests + upvotes ----
  const request = (title: string, details: string, authorHint: string, reciterHint: string, status: string, voters: number[]) => {
    const id = insert(
      "INSERT INTO kalam_request (title,details,author_hint,reciter_hint,status,created_by_id) VALUES (?,?,?,?,?,?)",
      title, details, authorHint, reciterHint, status, uContributor,
    );
    for (const v of voters) run("INSERT INTO request_upvote (request_id,user_id) VALUES (?,?)", id, v);
  };
  request("Kaali Kamli Walay — full qawwali version", "The complete majlis recording, if it can be sourced.", "", "Sabri Ensemble", "planned", crowd.slice(0, 6).concat(uContributor));
  request("Madinay Vich Rehann Waliye", "Any archival recording.", "", "", "open", crowd.slice(0, 3));
  request("Salam — Emaan vs Ishq", "", "", "", "fulfilled", crowd.slice(0, 8));

  // ---- submissions (Studio + admin review) ----
  const submission = (title: string, kind: string, status: string, note: string, author: number, authorName: string) =>
    insert(
      "INSERT INTO submission (title,kind,payload,status,reviewer_note,author_id,author_name) VALUES (?,?,?,?,?,?,?)",
      title, kind, JSON.stringify({ kind }), status, note, author, authorName,
    );
  submission("Tanam Farsooda — Zulfikar Ali", "timing", "accepted", "", uContributor, "Demo Contributor");
  submission("Aarzoo — translation", "translation", "in_review", "", uContributor, "Demo Contributor");
  submission("Kaali Kamli Walay — transcription", "transcription", "changes_requested", "check line 4", uContributor, "Demo Contributor");
  submission("Madinay Vich — source", "source", "submitted", "", uEditor, "Demo Editor");

  // ---- render jobs ----
  const render = (mode: string, res: string, langs: string[], status: string, fail: string, out: string) =>
    insert(
      `INSERT INTO video_generation_job (rendition_id,source_mode,layout_id,resolution,visible_language_codes,title,status,output_url,failure_reason)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      rTanam, mode, "overlay-basic", res, JSON.stringify(langs), "Tanam Farsooda Jaan Para", status, out, fail,
    );
  render("audio_visualizer", "1080p", ["fa", "en"], "completed", "", "/media/samples/tanam-farsooda/landscape-1080p.mp4");
  render("video_overlay", "2160p", ["fa", "en", "ur"], "running", "", "");
  render("audio_visualizer", "1080p", ["fa"], "queued", "", "");

  // ---- published files ----
  const published = (etype: string, eid: string, path: string, hash: string, sha: string, status: string, at: string | null) =>
    run(
      "INSERT INTO published_file (entity_type,entity_id,repo_path,content_hash,commit_sha,status,published_at) VALUES (?,?,?,?,?,?,?)",
      etype, eid, path, hash, sha, status, at,
    );
  published("kalam", "tanam-farsooda", "kalam/tanam-farsooda/kalam.md", "a3f9c2", "9b7c2e", "committed", now());
  published("rendition", "tanam-farsooda-local", "renditions/tanam-farsooda-local/timings.json", "", "", "pending", null);
  published("person", "jami", "people/jami.md", "5d1e77", "", "failed", null);

  db.exec("COMMIT");
} catch (e) {
  db.exec("ROLLBACK");
  console.error("[seed] failed, rolled back:", e);
  process.exit(1);
}

const counts = db
  .prepare(
    `SELECT (SELECT COUNT(*) FROM kalam) kalams, (SELECT COUNT(*) FROM rendition) renditions,
            (SELECT COUNT(*) FROM person) people, (SELECT COUNT(*) FROM collection) collections,
            (SELECT COUNT(*) FROM media_mirror) mirrors`,
  )
  .get() as Record<string, number>;
console.log(`[seed] done — ${counts.kalams} kalams, ${counts.renditions} renditions, ${counts.people} people, ${counts.collections} collections, ${counts.mirrors} mirrors.`);
