from __future__ import annotations

from pathlib import PurePosixPath

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from media.models import MediaAsset, MediaKind, ProcessingStatus
from media.services import public_media_url

from .models import VideoGenerationJob, VideoGenerationStatus


def build_render_payload(job: VideoGenerationJob) -> dict:
    lyric_set = job.lyric_set or getattr(job.track, "lyric_sets", None).filter(is_canonical=True).first() if job.track else job.lyric_set
    languages = []
    segments = []
    if lyric_set:
        language_qs = lyric_set.languages.all().order_by("display_order", "name")
        if job.visible_language_ids:
            requested = [str(item) for item in job.visible_language_ids]
            language_qs = [language for language in language_qs if str(language.id) in requested][:3]
        else:
            language_qs = list(language_qs[:3])
        languages = [
            {"id": str(language.id), "name": language.name, "code": language.code, "direction": language.direction, "role": language.role}
            for language in language_qs
        ]
        segments = [
            {
                "startMs": segment.start_ms,
                "endMs": segment.end_ms,
                "textByLanguageId": {str(key): value for key, value in segment.text_by_language.items()},
            }
            for segment in lyric_set.segments.all().order_by("start_ms")
        ]

    return {
        "jobId": f"video-job-{job.id}",
        "sourceMode": job.source_mode,
        "sourceAssetId": job.source_asset_id,
        "sourceUrl": public_media_url(job.source_asset.storage_key),
        "layoutId": job.layout_id,
        "resolution": job.resolution,
        "title": job.title,
        "voice": job.voice,
        "writer": job.writer,
        "visibleLanguages": languages,
        "segments": segments,
        "outputDir": str(settings.VIDEO_GENERATION_OUTPUT_DIR),
    }


def queue_video_generation(job: VideoGenerationJob) -> VideoGenerationJob:
    job.render_payload = build_render_payload(job)
    job.status = VideoGenerationStatus.QUEUED
    job.save(update_fields=["render_payload", "status", "updated_at"])
    try:
        from .tasks import render_video_generation_job

        result = render_video_generation_job.delay(job.id)
        job.celery_task_id = result.id
        job.save(update_fields=["celery_task_id", "updated_at"])
        job.refresh_from_db()
    except Exception as exc:
        job.log = f"Queued for manual/local rendering because Celery dispatch failed: {exc}"
        job.save(update_fields=["log", "updated_at"])
    return job


def generated_storage_key(job: VideoGenerationJob, suffix: str) -> str:
    return str(PurePosixPath(settings.MEDIA_GENERATED_PREFIX) / "videos" / f"video-job-{job.id}.{suffix}")


@transaction.atomic
def complete_render_placeholder(job: VideoGenerationJob) -> VideoGenerationJob:
    preview = MediaAsset.objects.create(
        title=f"{job.title} preview",
        kind=MediaKind.IMAGE,
        storage_key=generated_storage_key(job, "png"),
        mime_type="image/png",
        is_master=False,
        status=ProcessingStatus.READY,
        uploaded_by=job.requested_by,
        metadata={"generated_by_job_id": job.id, "role": "preview"},
    )
    output = MediaAsset.objects.create(
        title=f"{job.title} generated video",
        kind=MediaKind.VIDEO,
        storage_key=generated_storage_key(job, "mp4"),
        mime_type="video/mp4",
        is_master=False,
        status=ProcessingStatus.READY,
        uploaded_by=job.requested_by,
        metadata={"generated_by_job_id": job.id, "role": "output", "render_payload": job.render_payload},
    )
    job.preview_asset = preview
    job.output_asset = output
    job.status = VideoGenerationStatus.COMPLETED
    job.log = (job.log + "\n" if job.log else "") + "Rendered placeholder preview and output assets."
    job.save(update_fields=["preview_asset", "output_asset", "status", "log", "updated_at"])
    return job


def cancel_job(job: VideoGenerationJob) -> VideoGenerationJob:
    if job.status == VideoGenerationStatus.COMPLETED:
        return job
    job.status = VideoGenerationStatus.CANCELLED
    job.cancelled_at = timezone.now()
    job.log = (job.log + "\n" if job.log else "") + "Cancelled by user."
    job.save(update_fields=["status", "cancelled_at", "log", "updated_at"])
    return job


def publish_job(job: VideoGenerationJob) -> VideoGenerationJob:
    if job.status != VideoGenerationStatus.COMPLETED or not job.output_asset:
        raise ValueError("Only completed jobs with an output asset can be published.")
    if job.track:
        job.track.media_assets.add(job.output_asset)
    job.published_at = timezone.now()
    job.log = (job.log + "\n" if job.log else "") + "Published generated output."
    job.save(update_fields=["published_at", "log", "updated_at"])
    return job
