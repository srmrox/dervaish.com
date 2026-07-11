// Data access — Node's built-in SQLite (Node >= 22.5, run with --experimental-sqlite).
// No ORM: raw SQL + prepared statements. The schema (db/schema.sql) is applied
// idempotently on import. server.ts wires this in from Stage 3 onward.
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { env } from "./env.js";

export const db = new DatabaseSync(env.DB_PATH);
db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");

// ../db/schema.sql resolves relative to the compiled file (dist/db.js) → apps/api/db/schema.sql.
db.exec(readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8"));

// Prepared statements live here as the schema grows, e.g.:
//   export const q = { kalamBySlug: db.prepare("SELECT * FROM kalam WHERE slug = ?") };
