import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createReadStream, statSync } from "node:fs";
import { join, normalize, sep } from "node:path";
import { db } from "./db.js";
import { env } from "./env.js";
import { hashPassword, verifyPassword, newToken, userFromRequest, atLeast, type AuthUser } from "./auth.js";

// node:sqlite types params as SQLInputValue; our row values are `unknown`. This
// prepared-statement edge is the one place we loosen typing (raw SQL boundary).
/* eslint-disable @typescript-eslint/no-explicit-any */
const D = db as unknown as {
  prepare(sql: string): {
    all(...p: unknown[]): any[];
    get(...p: unknown[]): any;
    run(...p: unknown[]): { lastInsertRowid: number | bigint; changes: number };
  };
};

// --- tiny http helpers (no framework) --------------------------------------
function cors(req: IncomingMessage, res: ServerResponse): boolean {
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin ?? "*");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, Range");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  res.setHeader("Access-Control-Expose-Headers", "Content-Range, Accept-Ranges, Content-Length");
  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return true; }
  return false;
}
function json(res: ServerResponse, code: number, body: unknown): void {
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}
const page = <T>(results: T[]) => ({ count: results.length, next: null, previous: null, results });
const parse = <T>(text: string, fallback: T): T => {
  try { return JSON.parse(text) as T; } catch { return fallback; }
};
const bool = (n: unknown) => !!n;
async function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  if (!chunks.length) return {};
  return parse<Record<string, unknown>>(Buffer.concat(chunks).toString("utf8"), {});
}
const slugify = (s: string) =>
  s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || `item-${Date.now()}`;

// url_for(base_url, key) — the two-line federation helper.
const urlFor = (base: string, key: string) =>
  `${base.replace(/\/+$/, "")}/${(key || "").replace(/^\/+/, "")}`;

// --- lookups ----------------------------------------------------------------
const termLabel = (id: number | null): string | null =>
  id == null ? null : ((D.prepare("SELECT label FROM vocabulary_term WHERE id=?").get(id) as { label: string } | undefined)?.label ?? null);

type Row = Record<string, unknown>;

// --- serializers ------------------------------------------------------------
function creditsFor(col: "kalam_id" | "rendition_id", id: number) {
  const rows = D.prepare(
    `SELECT c.role, c.display_order, c.note, p.name AS person_name, p.slug AS person_slug
       FROM credit c JOIN person p ON p.id = c.person_id
      WHERE c.${col} = ? ORDER BY c.display_order, c.id`,
  ).all(id) as Row[];
  return rows.map((r) => ({
    role: r.role, person_name: r.person_name, person_slug: r.person_slug,
    display_order: r.display_order, note: r.note,
  }));
}

function playbackFor(rendition: Row) {
  const assets = D.prepare(
    `SELECT ma.* FROM rendition_asset ra JOIN media_asset ma ON ma.id = ra.asset_id WHERE ra.rendition_id = ?`,
  ).all(rendition.id) as Row[];

  const variants: unknown[] = [];
  for (const asset of assets) {
    const mirrorRows = D.prepare(
      `SELECT mm.slug, mm.name, mm.kind, mm.base_url, mm.is_default_enabled, mm.priority, mam.url_override
         FROM media_asset_mirror mam JOIN media_mirror mm ON mm.id = mam.mirror_id
        WHERE mam.asset_id = ? AND mam.available = 1 AND mm.is_active = 1
        ORDER BY mm.priority, mm.name`,
    ).all(asset.id) as Row[];
    const mirrors = mirrorRows.map((m) => ({
      mirror: m.slug, name: m.name, kind: m.kind,
      url: (m.url_override as string) || urlFor(m.base_url as string, asset.storage_key as string),
      default_enabled: bool(m.is_default_enabled), priority: m.priority,
    }));

    const vRows = D.prepare("SELECT * FROM media_variant WHERE asset_id = ?").all(asset.id) as Row[];
    for (const v of vRows) {
      const storage_key = (v.storage_key as string) || (asset.storage_key as string);
      variants.push({
        kind: asset.kind, storage_key, container: v.container,
        bitrate_kbps: v.bitrate_kbps ?? null, height: v.height ?? null,
        url: mirrors[0]?.url ?? (v.url as string) ?? storage_key,
        mirrors, streaming: bool(v.is_streaming), offline_download: bool(v.is_offline_download), source: false,
      });
    }
    // directly-playable external original (GitHub/etc.)
    if (asset.source_url) {
      variants.push({
        kind: asset.kind, storage_key: asset.storage_key, container: "",
        bitrate_kbps: null, height: asset.height ?? null, url: asset.source_url,
        mirrors: [{ mirror: "external-source", name: "Original source", kind: "external", url: asset.source_url, default_enabled: true, priority: 10 }],
        streaming: true, offline_download: false, source: true,
      });
    }
  }
  return { protection_level: rendition.protection_level, variants };
}

function serializeRendition(r: Row) {
  return {
    slug: r.slug, title: r.title, duration_ms: r.duration_ms, year: r.year ?? null,
    album: r.album, publisher: r.publisher, style: r.style,
    protection_level: r.protection_level, rights_note: r.rights_note,
    credits: creditsFor("rendition_id", r.id as number),
    playback: playbackFor(r),
  };
}

const authorName = (id: number | null) =>
  id == null ? null : ((D.prepare("SELECT name FROM person WHERE id=?").get(id) as { name: string } | undefined)?.name ?? null);

function kalamListItem(k: Row) {
  return {
    slug: k.slug, title: k.title, title_native: k.title_native, title_transliterated: k.title_transliterated,
    author_name: authorName(k.author_id as number | null), genre: termLabel(k.genre_id as number | null),
  };
}

function personRef(p: Row) {
  return { slug: p.slug, name: p.name, name_native: p.name_native, era: p.era, region: p.region };
}

function hasMedia(renditionId: number): boolean {
  const row = D.prepare(
    `SELECT COUNT(*) AS n FROM rendition_asset ra
       JOIN media_asset ma ON ma.id = ra.asset_id
       LEFT JOIN media_asset_mirror mam ON mam.asset_id = ma.id AND mam.available = 1
       LEFT JOIN media_mirror mm ON mm.id = mam.mirror_id AND mm.is_active = 1
      WHERE ra.rendition_id = ? AND (mm.id IS NOT NULL OR ma.source_url <> '')`,
  ).get(renditionId) as { n: number };
  return row.n > 0;
}

function renditionRef(r: Row) {
  const k = D.prepare("SELECT slug, title FROM kalam WHERE id=?").get(r.kalam_id) as Row | undefined;
  return {
    slug: r.slug, title: r.title, kalam_slug: k?.slug ?? "", kalam_title: k?.title ?? "",
    duration_ms: r.duration_ms, has_media: hasMedia(r.id as number),
  };
}

function kalamDetail(k: Row) {
  const author = D.prepare("SELECT * FROM person WHERE id=?").get(k.author_id) as Row | undefined;
  const themes = (D.prepare(
    `SELECT vt.label FROM kalam_theme kt JOIN vocabulary_term vt ON vt.id = kt.term_id WHERE kt.kalam_id = ?`,
  ).all(k.id) as Row[]).map((t) => t.label);
  const verses = (D.prepare(`SELECT * FROM verse WHERE kalam_id=? ORDER BY "order"`).all(k.id) as Row[]).map((v) => ({
    order: v.order, text_native: v.text_native, transliteration: v.transliteration,
    translations: parse(v.translations as string, {}), meaning: parse(v.meaning as string, {}),
    start_ms: v.start_ms ?? null, end_ms: v.end_ms ?? null,
  }));
  const renditions = (D.prepare(
    "SELECT * FROM rendition WHERE kalam_id=? AND visibility IN ('public','unlisted') ORDER BY published_at",
  ).all(k.id) as Row[]).map(serializeRendition);
  return {
    slug: k.slug, title: k.title, title_native: k.title_native, title_transliterated: k.title_transliterated,
    summary: k.summary, author: author ? personRef(author) : null,
    primary_language: termLabel(k.primary_language_id as number | null),
    genre: termLabel(k.genre_id as number | null), tradition: termLabel(k.tradition_id as number | null),
    era: k.era, themes, tags: parse(k.tags as string, []), verses,
    credits: creditsFor("kalam_id", k.id as number), renditions,
  };
}

function personDetail(p: Row) {
  const authored = (D.prepare(
    "SELECT * FROM kalam WHERE author_id=? AND visibility IN ('public','unlisted') ORDER BY title",
  ).all(p.id) as Row[]).map(kalamListItem);
  return {
    ...personRef(p), aliases: parse(p.aliases as string, []), biography: p.biography,
    tradition: termLabel(p.tradition_id as number | null), external_ids: parse(p.external_ids as string, {}),
    authored_kalams: authored,
  };
}

function serializeCollection(c: Row) {
  const n = (D.prepare("SELECT COUNT(*) AS n FROM collection_item WHERE collection_id=?").get(c.id) as { n: number }).n;
  return { slug: c.slug, title: c.title, description: c.description, is_curated: bool(c.is_curated), rendition_count: n };
}

function mirrorInfo(m: Row) {
  return {
    slug: m.slug, name: m.name, base_url: m.base_url, kind: m.kind,
    is_official: bool(m.is_official), is_active: bool(m.is_active),
    is_default_enabled: bool(m.is_default_enabled), verified: bool(m.verified),
    carries_all: bool(m.carries_all), priority: m.priority,
  };
}

const meShape = (u: AuthUser) => ({
  id: u.id, username: u.username, display_name: u.display_name || u.username,
  role: u.role, trust_score: u.trust_score,
});

function submissionShape(s: Row) {
  return {
    id: s.id, title: s.title, payload: parse(s.payload as string, {}), status: s.status,
    reviewer_note: s.reviewer_note, author_name: s.author_name, created_at: s.created_at, updated_at: s.updated_at,
  };
}

function requestShape(r: Row, viewer: AuthUser | null) {
  const upvotes = (D.prepare("SELECT COUNT(*) AS n FROM request_upvote WHERE request_id=?").get(r.id) as { n: number }).n;
  const has = viewer
    ? !!D.prepare("SELECT 1 FROM request_upvote WHERE request_id=? AND user_id=?").get(r.id, viewer.id)
    : false;
  return {
    id: r.id, title: r.title, details: r.details, author_hint: r.author_hint, reciter_hint: r.reciter_hint,
    status: r.status, upvotes, has_upvoted: has, created_at: r.created_at,
  };
}

function renderJobShape(j: Row) {
  const slug = j.rendition_id
    ? ((D.prepare("SELECT slug FROM rendition WHERE id=?").get(j.rendition_id) as { slug: string } | undefined)?.slug ?? null)
    : null;
  return {
    id: j.id, rendition: j.rendition_id ?? null, rendition_slug: slug, source_mode: j.source_mode,
    layout_id: j.layout_id, resolution: j.resolution, visible_language_codes: parse(j.visible_language_codes as string, []),
    title: j.title, status: j.status, output_url: j.output_url, failure_reason: j.failure_reason, created_at: j.created_at,
  };
}

const publishedShape = (p: Row) => ({
  id: p.id, entity_type: p.entity_type, entity_id: p.entity_id, repo_path: p.repo_path,
  content_hash: p.content_hash, commit_sha: p.commit_sha, status: p.status,
  published_at: p.published_at ?? null, created_at: p.created_at,
});

// --- media serving (Stage 2): GET /media/<key> with Range support ----------
function serveMedia(req: IncomingMessage, res: ServerResponse, key: string): void {
  const rel = normalize(decodeURIComponent(key)).replace(/^([/\\])+/, "");
  if (rel.split(sep).includes("..")) { json(res, 400, { error: "bad_path" }); return; }
  const abs = join(env.MEDIA_ROOT_ABS, rel);
  let size: number;
  try { size = statSync(abs).size; } catch { json(res, 404, { error: "not_found" }); return; }

  const ext = rel.slice(rel.lastIndexOf(".") + 1).toLowerCase();
  const type = ({ mp3: "audio/mpeg", mp4: "video/mp4", webm: "video/webm", json: "application/json", jpg: "image/jpeg", png: "image/png" } as Record<string, string>)[ext] ?? "application/octet-stream";
  res.setHeader("Accept-Ranges", "bytes");
  res.setHeader("Content-Type", type);

  const range = req.headers.range;
  if (range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range);
    let start = m && m[1] ? parseInt(m[1], 10) : 0;
    let end = m && m[2] ? parseInt(m[2], 10) : size - 1;
    if (Number.isNaN(start) || Number.isNaN(end) || start > end || end >= size) {
      res.writeHead(416, { "Content-Range": `bytes */${size}` }); res.end(); return;
    }
    start = Math.max(0, start); end = Math.min(end, size - 1);
    res.writeHead(206, { "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": end - start + 1 });
    if (req.method === "HEAD") { res.end(); return; }
    createReadStream(abs, { start, end }).pipe(res);
  } else {
    res.writeHead(200, { "Content-Length": size });
    if (req.method === "HEAD") { res.end(); return; }
    createReadStream(abs).pipe(res);
  }
}

// --- router -----------------------------------------------------------------
const server = createServer(async (req, res) => {
  try {
    if (cors(req, res)) return;
    const method = req.method ?? "GET";
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    const path = url.pathname.replace(/\/+$/, "") || "/"; // tolerate trailing slash
    const seg = path.split("/").filter(Boolean);

    // top-level
    if (path === "/healthz") return json(res, 200, { status: "ok", service: "dervaish-api", ts: new Date().toISOString() });
    if (seg[0] === "media") return serveMedia(req, res, seg.slice(1).join("/"));
    if (path === "/api/v1") return json(res, 200, { api: "v1", status: "ok" });

    if (seg[0] !== "api" || seg[1] !== "v1") return json(res, 404, { error: "not_found", path });
    const r = seg.slice(2); // route under /api/v1
    const viewer = userFromRequest(req);

    // ---------- auth ----------
    if (r[0] === "auth" && r[1] === "login" && method === "POST") {
      const b = await readBody(req);
      const user = D.prepare("SELECT * FROM user WHERE username=?").get(String(b.username ?? "")) as Row | undefined;
      if (!user || !verifyPassword(String(b.password ?? ""), user.password_hash as string))
        return json(res, 400, { error: "invalid_credentials", detail: "Incorrect username or password." });
      const token = newToken();
      D.prepare("INSERT INTO auth_token (token,user_id) VALUES (?,?)").run(token, user.id);
      return json(res, 200, { token });
    }
    if (r[0] === "auth" && r[1] === "register" && method === "POST") {
      const b = await readBody(req);
      const username = String(b.username ?? "").trim();
      if (!username || !b.password) return json(res, 400, { error: "invalid", detail: "Username and password are required." });
      if (D.prepare("SELECT 1 FROM user WHERE username=?").get(username)) return json(res, 400, { error: "taken", detail: "That username is taken." });
      const id = Number(D.prepare(
        "INSERT INTO user (username,password_hash,role,display_name) VALUES (?,?, 'listener', ?)",
      ).run(username, hashPassword(String(b.password)), String(b.display_name ?? username)).lastInsertRowid);
      const u = D.prepare("SELECT * FROM user WHERE id=?").get(id) as AuthUser;
      return json(res, 201, meShape(u));
    }
    if (r[0] === "auth" && r[1] === "logout" && method === "POST") {
      const header = req.headers["authorization"];
      const tok = typeof header === "string" ? /^Token\s+(.+)$/i.exec(header)?.[1] : undefined;
      if (tok) D.prepare("DELETE FROM auth_token WHERE token=?").run(tok);
      return json(res, 204, undefined);
    }

    // ---------- me ----------
    if (r[0] === "me" && r.length === 1) {
      if (!viewer) return json(res, 401, { error: "unauthenticated", detail: "Sign in required." });
      return json(res, 200, meShape(viewer));
    }
    if (r[0] === "me" && r[1] === "preferences") {
      if (!viewer) return json(res, 401, { error: "unauthenticated" });
      if (method === "GET") return json(res, 200, parse((viewer.preferences as string) ?? "{}", {}));
      const b = await readBody(req);
      D.prepare("UPDATE user SET preferences=? WHERE id=?").run(JSON.stringify(b), viewer.id);
      return json(res, 200, b);
    }
    if (r[0] === "me" && r[1] === "library") {
      if (!viewer) return json(res, 401, { error: "unauthenticated" });
      if (method === "GET") {
        const rows = D.prepare(
          `SELECT r.*, s.created_at AS saved_at FROM saved_item s JOIN rendition r ON r.id = s.rendition_id
            WHERE s.user_id = ? ORDER BY s.created_at DESC`,
        ).all(viewer.id) as Row[];
        return json(res, 200, page(rows.map((row) => ({ rendition_detail: renditionRef(row), created_at: row.saved_at }))));
      }
    }
    if (r[0] === "me" && r[1] === "queues") {
      if (!viewer) return json(res, 401, { error: "unauthenticated" });
      if (method === "GET") {
        const rows = D.prepare(
          `SELECT r.*, qi.position FROM queue q JOIN queue_item qi ON qi.queue_id = q.id
             JOIN rendition r ON r.id = qi.rendition_id WHERE q.user_id = ? ORDER BY qi.position`,
        ).all(viewer.id) as Row[];
        return json(res, 200, page(rows.map((row) => ({ rendition_detail: renditionRef(row), position: row.position }))));
      }
    }

    // ---------- catalog (public) ----------
    if (r[0] === "kalams" && r.length === 1 && method === "GET") {
      const rows = D.prepare("SELECT * FROM kalam WHERE visibility IN ('public','unlisted') ORDER BY published_at DESC, title").all() as Row[];
      return json(res, 200, page(rows.map(kalamListItem)));
    }
    if (r[0] === "kalams" && r[1] && method === "GET") {
      const k = D.prepare("SELECT * FROM kalam WHERE slug=? AND visibility IN ('public','unlisted')").get(r[1]) as Row | undefined;
      return k ? json(res, 200, kalamDetail(k)) : json(res, 404, { error: "not_found" });
    }
    if (r[0] === "renditions" && r[1] && method === "GET") {
      const rr = D.prepare("SELECT * FROM rendition WHERE slug=? AND visibility IN ('public','unlisted')").get(r[1]) as Row | undefined;
      return rr ? json(res, 200, serializeRendition(rr)) : json(res, 404, { error: "not_found" });
    }
    if (r[0] === "people" && r.length === 1 && method === "GET") {
      const rows = D.prepare("SELECT * FROM person WHERE visibility IN ('public','unlisted') ORDER BY name").all() as Row[];
      return json(res, 200, page(rows.map(personRef)));
    }
    if (r[0] === "people" && r[1] && method === "GET") {
      const p = D.prepare("SELECT * FROM person WHERE slug=? AND visibility IN ('public','unlisted')").get(r[1]) as Row | undefined;
      return p ? json(res, 200, personDetail(p)) : json(res, 404, { error: "not_found" });
    }
    if (r[0] === "collections" && r.length === 1 && method === "GET") {
      const rows = D.prepare("SELECT * FROM collection WHERE visibility IN ('public','unlisted') ORDER BY is_curated DESC, title").all() as Row[];
      return json(res, 200, page(rows.map(serializeCollection)));
    }
    if (r[0] === "collections" && r[1] && method === "GET") {
      const c = D.prepare("SELECT * FROM collection WHERE slug=?").get(r[1]) as Row | undefined;
      if (!c) return json(res, 404, { error: "not_found" });
      if (!["public", "unlisted"].includes(c.visibility as string) && (!viewer || viewer.id !== c.owner_id))
        return json(res, 404, { error: "not_found" });
      return json(res, 200, serializeCollection(c));
    }
    if (r[0] === "search" && method === "GET") {
      const q = (url.searchParams.get("q") ?? "").trim();
      const like = `%${q}%`;
      const kalams = q ? (D.prepare(
        "SELECT * FROM kalam WHERE visibility IN ('public','unlisted') AND (title LIKE ? OR title_transliterated LIKE ? OR title_native LIKE ?) LIMIT 25",
      ).all(like, like, like) as Row[]).map(kalamListItem) : [];
      const people = q ? (D.prepare(
        "SELECT * FROM person WHERE visibility IN ('public','unlisted') AND (name LIKE ? OR name_native LIKE ?) LIMIT 25",
      ).all(like, like) as Row[]).map(personRef) : [];
      const renditions = q ? (D.prepare(
        `SELECT rn.* FROM rendition rn JOIN kalam k ON k.id = rn.kalam_id
          WHERE rn.visibility IN ('public','unlisted') AND (rn.title LIKE ? OR k.title LIKE ?) LIMIT 25`,
      ).all(like, like) as Row[]).map(renditionRef) : [];
      const collections = q ? (D.prepare(
        "SELECT * FROM collection WHERE visibility IN ('public','unlisted') AND title LIKE ? LIMIT 25",
      ).all(like) as Row[]).map(serializeCollection) : [];
      return json(res, 200, { kalams, people, renditions, collections });
    }

    // ---------- federation ----------
    if (r[0] === "directory" && r[1] === "mirrors" && method === "GET") {
      const rows = D.prepare("SELECT * FROM media_mirror WHERE is_active=1 ORDER BY priority, name").all() as Row[];
      return json(res, 200, page(rows.map(mirrorInfo)));
    }
    if (r[0] === "directory" && r[1] === "sources" && method === "GET") {
      const rows = D.prepare("SELECT * FROM content_source WHERE is_enabled=1 ORDER BY priority, name").all() as Row[];
      return json(res, 200, page(rows.map((s) => ({
        slug: s.slug, name: s.name, base_url: s.base_url, kind: s.kind,
        is_official: bool(s.is_official), is_default: bool(s.is_default), verified: bool(s.verified), priority: s.priority,
      }))));
    }

    // ---------- contribution ----------
    if (r[0] === "submissions" && r.length === 1) {
      if (!viewer) return json(res, 401, { error: "unauthenticated" });
      if (method === "GET") {
        const rows = D.prepare("SELECT * FROM submission WHERE author_id=? ORDER BY created_at DESC").all(viewer.id) as Row[];
        return json(res, 200, page(rows.map(submissionShape)));
      }
      if (method === "POST") {
        const b = await readBody(req);
        const payload = (b.payload ?? {}) as Record<string, unknown>;
        const id = Number(D.prepare(
          "INSERT INTO submission (title,kind,payload,status,author_id,author_name) VALUES (?,?,?, 'submitted', ?,?)",
        ).run(String(b.title ?? "Untitled"), String((payload.kind as string) ?? "source"), JSON.stringify(payload), viewer.id, viewer.display_name || viewer.username).lastInsertRowid);
        return json(res, 201, submissionShape(D.prepare("SELECT * FROM submission WHERE id=?").get(id) as Row));
      }
    }
    if (r[0] === "community" && r[1] === "requests" && r.length === 2) {
      if (method === "GET") {
        const rows = D.prepare("SELECT * FROM kalam_request ORDER BY created_at DESC").all() as Row[];
        return json(res, 200, page(rows.map((row) => requestShape(row, viewer))));
      }
      if (method === "POST") {
        if (!viewer) return json(res, 401, { error: "unauthenticated" });
        const b = await readBody(req);
        const id = Number(D.prepare(
          "INSERT INTO kalam_request (title,details,author_hint,reciter_hint,created_by_id) VALUES (?,?,?,?,?)",
        ).run(String(b.title ?? "Untitled"), String(b.details ?? ""), String(b.author_hint ?? ""), String(b.reciter_hint ?? ""), viewer.id).lastInsertRowid);
        return json(res, 201, requestShape(D.prepare("SELECT * FROM kalam_request WHERE id=?").get(id) as Row, viewer));
      }
    }
    if (r[0] === "community" && r[1] === "requests" && r[3] === "upvote" && method === "POST") {
      if (!viewer) return json(res, 401, { error: "unauthenticated" });
      const id = Number(r[2]);
      const existing = D.prepare("SELECT 1 FROM request_upvote WHERE request_id=? AND user_id=?").get(id, viewer.id);
      if (existing) D.prepare("DELETE FROM request_upvote WHERE request_id=? AND user_id=?").run(id, viewer.id);
      else D.prepare("INSERT INTO request_upvote (request_id,user_id) VALUES (?,?)").run(id, viewer.id);
      const upvotes = (D.prepare("SELECT COUNT(*) AS n FROM request_upvote WHERE request_id=?").get(id) as { n: number }).n;
      return json(res, 200, { upvotes, has_upvoted: !existing });
    }

    // ---------- admin (editor+) ----------
    if (r[0] === "admin") {
      if (!viewer || !atLeast(viewer.role, "editor")) return json(res, 403, { error: "forbidden", detail: "Editor access required." });

      if (r[1] === "review" && r[2] === "submissions" && r.length === 3 && method === "GET") {
        const status = url.searchParams.get("status");
        const rows = (status
          ? D.prepare("SELECT * FROM submission WHERE status=? ORDER BY created_at DESC").all(status)
          : D.prepare("SELECT * FROM submission ORDER BY created_at DESC").all()) as Row[];
        return json(res, 200, page(rows.map(submissionShape)));
      }
      if (r[1] === "review" && r[2] === "submissions" && r[4] === "review" && method === "POST") {
        const b = await readBody(req);
        D.prepare("UPDATE submission SET status=?, reviewer_note=?, updated_at=? WHERE id=?")
          .run(String(b.status ?? "in_review"), String(b.reviewer_note ?? ""), new Date().toISOString(), Number(r[3]));
        return json(res, 200, submissionShape(D.prepare("SELECT * FROM submission WHERE id=?").get(Number(r[3])) as Row));
      }
      if (r[1] === "review" && r[2] === "submissions" && r[4] === "apply" && method === "POST") {
        D.prepare("UPDATE submission SET status='applied', updated_at=? WHERE id=?").run(new Date().toISOString(), Number(r[3]));
        return json(res, 200, { applied: true });
      }
      if (r[1] === "renders" && method === "GET") {
        const rows = D.prepare("SELECT * FROM video_generation_job ORDER BY created_at DESC").all() as Row[];
        return json(res, 200, page(rows.map(renderJobShape)));
      }
      if (r[1] === "published" && r.length === 2 && method === "GET") {
        const rows = D.prepare("SELECT * FROM published_file ORDER BY created_at DESC").all() as Row[];
        return json(res, 200, page(rows.map(publishedShape)));
      }
      if (r[1] === "published" && r[2] === "publish-kalam" && r[3] && method === "POST") {
        const slug = r[3];
        const rp = `kalam/${slug}/kalam.md`;
        D.prepare("INSERT INTO published_file (entity_type,entity_id,repo_path,status,published_at) VALUES ('kalam',?,?, 'committed', ?)")
          .run(slug, rp, new Date().toISOString());
        const rows = D.prepare("SELECT * FROM published_file WHERE entity_id=? ORDER BY created_at DESC").all(slug) as Row[];
        return json(res, 200, rows.map(publishedShape));
      }
    }

    return json(res, 404, { error: "not_found", path });
  } catch (e) {
    console.error("[api] error:", e);
    if (!res.headersSent) json(res, 500, { error: "server_error", detail: (e as Error).message });
  }
});

server.listen(env.PORT, env.HOST, () => {
  console.log(`dervaish-api on http://${env.HOST}:${env.PORT}  ·  media root ${env.MEDIA_ROOT_ABS}`);
});

void slugify; // reserved for future create routes
