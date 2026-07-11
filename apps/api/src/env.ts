import { resolve } from "node:path";

// Env is loaded by `node --env-file=.env` (no dotenv). Read process.env with
// defaults + a couple of hand guards — no zod.
function read(name: string, fallback: string): string {
  const v = process.env[name];
  return v === undefined || v === "" ? fallback : v;
}

const PORT = Number(read("PORT", "8000"));
if (!Number.isInteger(PORT) || PORT <= 0) {
  throw new Error(`Invalid PORT: ${JSON.stringify(process.env.PORT)}`);
}

const MEDIA_ROOT = read("MEDIA_ROOT", "../../mediafiles");

export const env = {
  PORT,
  HOST: read("HOST", "0.0.0.0"),
  MEDIA_ROOT,
  DB_PATH: read("DB_PATH", "./dervaish.db"),
  /** Absolute media root, resolved from the api package dir (process.cwd()). */
  MEDIA_ROOT_ABS: resolve(process.cwd(), MEDIA_ROOT),
};

export type Env = typeof env;
