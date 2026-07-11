// Password hashing + opaque tokens using node:crypto only (no deps).
// Hash format: "salt:scryptHex" (see docs/node/auth-users.md).
import { scryptSync, randomBytes, timingSafeEqual } from "node:crypto";
import type { IncomingMessage } from "node:http";
import { db } from "./db.js";

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const expected = Buffer.from(hash, "hex");
  const actual = scryptSync(password, salt, 64);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function newToken(): string {
  return randomBytes(32).toString("hex");
}

export interface AuthUser {
  id: number;
  username: string;
  display_name: string;
  role: "listener" | "contributor" | "editor" | "admin";
  trust_score: number;
  preferences: string;
}

const ROLE_RANK: Record<string, number> = { listener: 1, contributor: 2, editor: 3, admin: 4 };
export const atLeast = (role: string, min: string) => (ROLE_RANK[role] ?? 0) >= (ROLE_RANK[min] ?? 99);

/** Resolve the caller from an `Authorization: Token <token>` header, or null. */
export function userFromRequest(req: IncomingMessage): AuthUser | null {
  const header = req.headers["authorization"];
  if (!header || Array.isArray(header)) return null;
  const m = /^Token\s+(.+)$/i.exec(header.trim());
  if (!m) return null;
  const row = db
    .prepare(
      `SELECT u.id, u.username, u.display_name, u.role, u.trust_score, u.preferences
         FROM auth_token t JOIN user u ON u.id = t.user_id WHERE t.token = ?`,
    )
    .get(m[1]) as AuthUser | undefined;
  return row ?? null;
}
