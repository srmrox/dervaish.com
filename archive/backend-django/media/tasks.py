"""Celery media-processing pipeline (master plan §12).

``process_media_asset`` downloads the immutable original, probes it, transcodes
the per-kind profiles, uploads each variant, and records ``MediaRendition`` rows.
Durable status/log/error live on the asset so admins and the API can see state.
Failures are recorded (not raised) so one bad asset never wedges the worker.
"""
from __future__ import annotations

import os

from celery import shared_task
from django.utils import timezone

from . import storage, transcode
from .models import MediaAsset, MediaRendition, ProcessingStatus


@shared_task
def process_media_asset(asset_id: int) -> dict:
    asset = MediaAsset.objects.get(pk=asset_id)
    asset.processing_status = ProcessingStatus.PROCESSING
    asset.processing_attempts += 1
    asset.processing_error = ""
    asset.save(update_fields=["processing_status", "processing_attempts", "processing_error"])

    log: list[str] = [f"[{timezone.now():%Y-%m-%d %H:%M:%S}] start (attempt {asset.processing_attempts})"]
    local_in = None
    created = 0
    try:
        if not asset.storage_key:
            raise ValueError("asset has no storage_key (original not uploaded)")

        ext = storage.guess_ext(asset.mime_type, asset.original_filename)
        local_in = storage.download_to_temp(asset.storage_key, suffix=f".{ext}")
        meta = transcode.ffprobe_metadata(local_in)
        asset.duration_ms = meta["duration_ms"] or asset.duration_ms
        asset.width, asset.height = meta["width"], meta["height"]
        log.append(f"probed: {meta}")

        for profile in transcode.profiles_for(asset.kind):
            local_out = f"{local_in}.{profile.variant}.{profile.ext}"
            transcode.run_ffmpeg(local_in, local_out, profile.ffmpeg_args)
            key = storage.storage_key_for(asset.kind, asset.id, profile.variant, profile.ext)
            storage.upload_file(local_out, key)
            MediaRendition.objects.update_or_create(
                asset=asset, container=profile.container,
                defaults={
                    "codec": profile.codec,
                    "bitrate_kbps": profile.bitrate_kbps,
                    "height": profile.height,
                    "storage_key": key,
                    "is_streaming": profile.is_streaming,
                    "is_offline_download": profile.is_offline_download,
                    "processing_status": ProcessingStatus.READY,
                },
            )
            created += 1
            log.append(f"variant {profile.variant} → {key}")
            _safe_remove(local_out)

        if asset.kind == "video":
            poster_out = f"{local_in}.poster.jpg"
            transcode.make_poster(local_in, poster_out)
            storage.upload_file(poster_out, storage.storage_key_for(asset.kind, asset.id, "poster", "jpg"))
            _safe_remove(poster_out)
            log.append("poster generated")

        asset.processing_status = ProcessingStatus.READY
        log.append(f"done: {created} variant(s)")
    except Exception as exc:  # noqa: BLE001 — record any failure durably, don't crash the worker
        asset.processing_status = ProcessingStatus.FAILED
        asset.processing_error = str(exc)[:300]
        log.append(f"FAILED: {exc}")
    finally:
        if local_in:
            _safe_remove(local_in)
        asset.processing_log = "\n".join(log)
        asset.save(update_fields=[
            "processing_status", "processing_error", "processing_log",
            "duration_ms", "width", "height",
        ])

    return {"asset_id": asset.id, "status": asset.processing_status, "variants": created}


def _safe_remove(path: str) -> None:
    try:
        os.remove(path)
    except OSError:
        pass
