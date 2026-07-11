"""Storage helpers for the media plane (master plan §4A, §12).

Originals are immutable; variants are derived. Keys follow
``{env}/{kind}/{asset_id}/{variant}.{ext}`` so objects are predictable and the
CDN/mirror resolver can build URLs from the key alone.

Works against whatever Django's ``default_storage`` is: Cloudflare R2/S3 in
production (presigned direct uploads) or the local filesystem in dev/tests
(server-mediated upload — ``presigned_put_url`` returns ``None``).
"""
from __future__ import annotations

import os
import tempfile

from django.core.files import File
from django.core.files.storage import default_storage

STORAGE_ENV = os.getenv("STORAGE_ENV", "dev")

_EXT_BY_MIME = {
    "audio/mpeg": "mp3", "audio/mp4": "m4a", "audio/aac": "aac",
    "audio/ogg": "ogg", "audio/opus": "opus", "audio/wav": "wav", "audio/flac": "flac",
    "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov",
}


def guess_ext(mime_type: str = "", filename: str = "") -> str:
    if filename and "." in filename:
        return filename.rsplit(".", 1)[-1].lower()
    return _EXT_BY_MIME.get(mime_type, "bin")


def is_s3() -> bool:
    return default_storage.__class__.__module__.startswith("storages.")


def storage_key_for(kind: str, asset_id: int, variant: str, ext: str) -> str:
    """e.g. ('audio', 4127, 'opus-128', 'opus') → 'dev/audio/4127/opus-128.opus'."""
    return f"{STORAGE_ENV}/{kind}/{asset_id}/{variant}.{ext}"


def original_key_for(kind: str, asset_id: int, ext: str) -> str:
    return f"{STORAGE_ENV}/{kind}/{asset_id}/original.{ext}"


def presigned_put_url(storage_key: str, content_type: str, expires: int = 3600) -> str | None:
    """A presigned S3/R2 PUT URL for a direct-to-storage upload, or None on local FS."""
    if not is_s3():
        return None
    client = default_storage.connection.meta.client
    return client.generate_presigned_url(
        "put_object",
        Params={
            "Bucket": default_storage.bucket_name,
            "Key": storage_key,
            "ContentType": content_type,
        },
        ExpiresIn=expires,
    )


def download_to_temp(storage_key: str, suffix: str = "") -> str:
    """Copy a stored object to a local temp file; returns the temp path."""
    fd, path = tempfile.mkstemp(suffix=suffix)
    with os.fdopen(fd, "wb") as out, default_storage.open(storage_key, "rb") as src:
        for chunk in src.chunks():
            out.write(chunk)
    return path


def upload_file(local_path: str, storage_key: str) -> str:
    """Store a local file at ``storage_key`` (overwriting), returns the key."""
    if default_storage.exists(storage_key):
        default_storage.delete(storage_key)
    with open(local_path, "rb") as f:
        default_storage.save(storage_key, File(f))
    return storage_key
