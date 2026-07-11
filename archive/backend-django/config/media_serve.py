"""Local media access mechanism — a proper, range-capable file server for the
local mirror. Serves files under MEDIA_ROOT with HTTP Range support (so audio/
video seeking works), path-traversal protection, and correct content types.

This is the "run it locally" media plane: no CDN, no DEBUG-only static hack.
Larger public deployments should still front MEDIA_ROOT with nginx/a CDN.
"""
from __future__ import annotations

import mimetypes
import os
import re

from django.conf import settings
from django.http import Http404, StreamingHttpResponse

_RANGE = re.compile(r"bytes=(\d+)-(\d*)")
_CHUNK = 64 * 1024

# Explicit types — mimetypes is registry-dependent on Windows and can return
# octet-stream for .mp3 (which forces a download and breaks <audio>/<video>).
_TYPES = {
    ".mp3": "audio/mpeg",
    ".m4a": "audio/mp4",
    ".aac": "audio/aac",
    ".opus": "audio/ogg",
    ".ogg": "audio/ogg",
    ".oga": "audio/ogg",
    ".wav": "audio/wav",
    ".flac": "audio/flac",
    ".mp4": "video/mp4",
    ".m4v": "video/mp4",
    ".webm": "video/webm",
    ".mov": "video/quicktime",
    ".m3u8": "application/vnd.apple.mpegurl",
    ".vtt": "text/vtt",
}


def _iter_file(path: str, start: int, length: int):
    with open(path, "rb") as f:
        f.seek(start)
        remaining = length
        while remaining > 0:
            data = f.read(min(_CHUNK, remaining))
            if not data:
                break
            remaining -= len(data)
            yield data


def serve_media(request, path: str):
    root = os.path.realpath(str(settings.MEDIA_ROOT))
    full = os.path.realpath(os.path.join(root, path))
    # Refuse anything that escapes MEDIA_ROOT (path traversal).
    if full != root and not full.startswith(root + os.sep):
        raise Http404()
    if not os.path.isfile(full):
        raise Http404()

    size = os.path.getsize(full)
    ext = os.path.splitext(full)[1].lower()
    content_type = _TYPES.get(ext) or mimetypes.guess_type(full)[0] or "application/octet-stream"
    match = _RANGE.match(request.headers.get("Range", "") or "")

    if match:
        start = int(match.group(1))
        end = int(match.group(2)) if match.group(2) else size - 1
        end = min(end, size - 1)
        if start > end:
            start = 0
        length = end - start + 1
        resp = StreamingHttpResponse(
            _iter_file(full, start, length), status=206, content_type=content_type
        )
        resp["Content-Range"] = f"bytes {start}-{end}/{size}"
        resp["Content-Length"] = str(length)
    else:
        resp = StreamingHttpResponse(_iter_file(full, 0, size), content_type=content_type)
        resp["Content-Length"] = str(size)

    resp["Accept-Ranges"] = "bytes"
    resp["Cache-Control"] = "public, max-age=3600"
    return resp
