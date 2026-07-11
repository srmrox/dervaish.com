# Media serving — `GET /media/*`

The correctness-critical part. Reproduce `archive/backend-django/config/media_serve.py` with **pure
`node:http` + `node:fs`** (no framework, no static middleware). This is what kills the carried-over
**0:00 playback bug**. All four rules are load-bearing.

## Rules

1. **Route** `GET /media/*` → resolve the path under `MEDIA_ROOT` (repo-root `mediafiles/`,
   overridable by env). **Reject path traversal**: the resolved absolute path must stay inside the
   resolved root (`full === root || full.startsWith(root + sep)`), else 404.
2. **Content-Type from an explicit map** (never let audio go out as `octet-stream` — on Windows the
   platform MIME lookup returns octet-stream for `.mp3`, which forces a download and breaks
   `<audio>`/`<video>`):

   | ext | type | ext | type |
   |-----|------|-----|------|
   | `.mp3` | audio/mpeg | `.mp4` `.m4v` | video/mp4 |
   | `.m4a` | audio/mp4 | `.webm` | video/webm |
   | `.aac` | audio/aac | `.mov` | video/quicktime |
   | `.opus` `.ogg` `.oga` | audio/ogg | `.m3u8` | application/vnd.apple.mpegurl |
   | `.wav` | audio/wav | `.vtt` | text/vtt |
   | `.flac` | audio/flac | | |

3. **Range handling (RFC 7233):**
   - No `Range` header → **200 OK**, full body, `Content-Length: size`, `Accept-Ranges: bytes`.
   - `Range: bytes=start-[end]` → **206 Partial Content**, stream that slice, set
     `Content-Range: bytes start-end/size` and `Content-Length: sliceLen`.
   - **Never send 206 without a `Range` header.** This exact bug makes duration read 0 and playback
     stall in Firefox.
4. **Stream, don't buffer** (`fs.createReadStream(path, { start, end })`) so seeking works and large
   files don't blow memory. Add `Cache-Control: public, max-age=3600`. Always send `Accept-Ranges: bytes`.

## Implementation — `src/routes/media.ts` (standard library only, ≈ 45 lines)

The router calls this for `GET`/`HEAD` on `/media/<rel>`, passing the decoded path after `/media/`.

```ts
import { createReadStream, promises as fs } from "node:fs";
import { resolve, sep, extname } from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import { env } from "../env.js";

const TYPES: Record<string, string> = {
  ".mp3":"audio/mpeg", ".m4a":"audio/mp4", ".aac":"audio/aac",
  ".opus":"audio/ogg", ".ogg":"audio/ogg", ".oga":"audio/ogg",
  ".wav":"audio/wav", ".flac":"audio/flac",
  ".mp4":"video/mp4", ".m4v":"video/mp4", ".webm":"video/webm", ".mov":"video/quicktime",
  ".m3u8":"application/vnd.apple.mpegurl", ".vtt":"text/vtt",
};
const RANGE = /^bytes=(\d+)-(\d*)$/;
const root = resolve(env.MEDIA_ROOT_ABS);

export async function serveMedia(req: IncomingMessage, res: ServerResponse, rel: string) {
  const full = resolve(root, rel);
  if (full !== root && !full.startsWith(root + sep)) return end(res, 404);   // path traversal

  let stat;
  try { stat = await fs.stat(full); } catch { return end(res, 404); }
  if (!stat.isFile()) return end(res, 404);

  const size = stat.size;
  const headers: Record<string, string | number> = {
    "Content-Type": TYPES[extname(full).toLowerCase()] ?? "application/octet-stream",
    "Accept-Ranges": "bytes",
    "Cache-Control": "public, max-age=3600",
  };

  const m = RANGE.exec(req.headers.range ?? "");
  if (m) {
    let start = parseInt(m[1], 10);
    let stop = m[2] ? parseInt(m[2], 10) : size - 1;
    stop = Math.min(stop, size - 1);
    if (start > stop) start = 0;
    res.writeHead(206, { ...headers, "Content-Range": `bytes ${start}-${stop}/${size}`, "Content-Length": stop - start + 1 });
    if (req.method === "HEAD") return res.end();
    createReadStream(full, { start, end: stop }).pipe(res);
    return;
  }

  res.writeHead(200, { ...headers, "Content-Length": size });       // 200, full body
  if (req.method === "HEAD") return res.end();
  createReadStream(full).pipe(res);
}

function end(res: ServerResponse, code: number) { res.writeHead(code); res.end(); }
```

That's the whole media plane — `node:http` + `node:fs`, zero dependencies. Streaming, Range, and
correct MIME are all standard-library behaviour.

## Verify (matches the Stage 2 cards in status.html)

```bash
curl -I http://localhost:8000/media/samples/tanam-farsooda/audio.mp3
#   → 200, Content-Type: audio/mpeg, Accept-Ranges: bytes

curl -H "Range: bytes=0-1023" -D - -o /dev/null \
     http://localhost:8000/media/samples/tanam-farsooda/audio.mp3
#   → 206, Content-Range: bytes 0-1023/<size>, Content-Length: 1024

# then open the URL in a browser → must play INLINE, not download; duration non-zero.
```

The frontend already surfaces the real cause of media failures: `src/lib/player.tsx` fires an
`error` listener printing `NETWORK / DECODE / SRC_NOT_SUPPORTED` + the failing `src`, shown as a red
line under "Renditions" in `KalamScreen.tsx`. Once this endpoint is correct, that line clears and
duration is non-zero.
