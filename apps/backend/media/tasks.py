from __future__ import annotations

from pathlib import PurePosixPath

from celery import shared_task
from django.conf import settings
from django.utils import timezone

from .models import MediaAsset, MediaDerivative, MediaProcessingJob, MediaProcessingJobKind, MediaRendition, ProcessingStatus


def playable_format_for_asset(asset: MediaAsset) -> tuple[str, str]:
    if asset.kind == "audio":
        return "mp3", "mp3"
    if asset.kind == "video":
        return "mp4", "h264/aac"
    if asset.kind == "image":
        return "jpg", "jpeg"
    return "bin", ""


@shared_task(bind=True, autoretry_for=(), max_retries=0)
def process_media_asset(self, job_id: int) -> int:
    job = MediaProcessingJob.objects.select_related("asset").get(id=job_id)
    asset = job.asset
    job.status = ProcessingStatus.PROCESSING
    job.started_at = timezone.now()
    job.attempts += 1
    job.celery_task_id = self.request.id or job.celery_task_id
    job.save(update_fields=["status", "started_at", "attempts", "celery_task_id", "updated_at"])

    try:
        output_format, codec = playable_format_for_asset(asset)
        stem = PurePosixPath(asset.storage_key).stem
        rendition_key = str(PurePosixPath(settings.MEDIA_RENDITIONS_PREFIX) / asset.kind / f"{stem}.{output_format}")
        rendition, _ = MediaRendition.objects.update_or_create(
            asset=asset,
            format=output_format,
            defaults={
                "codec": codec,
                "storage_key": rendition_key,
                "size_bytes": asset.size_bytes,
                "status": ProcessingStatus.READY,
                "is_playable": asset.kind in {"audio", "video"},
            },
        )

        if asset.kind in {"audio", "video"}:
            waveform_key = str(PurePosixPath(settings.MEDIA_RENDITIONS_PREFIX) / "waveforms" / f"{stem}.json")
            MediaDerivative.objects.update_or_create(
                asset=asset,
                kind=MediaDerivative.DerivativeKind.WAVEFORM,
                defaults={
                    "storage_key": waveform_key,
                    "format": "json",
                    "status": ProcessingStatus.READY,
                    "metadata": {"peaks": [], "placeholder": True},
                },
            )

        if asset.kind in {"video", "image"}:
            thumbnail_key = str(PurePosixPath(settings.MEDIA_RENDITIONS_PREFIX) / "thumbnails" / f"{stem}.jpg")
            MediaDerivative.objects.update_or_create(
                asset=asset,
                kind=MediaDerivative.DerivativeKind.THUMBNAIL,
                defaults={
                    "storage_key": thumbnail_key,
                    "format": "jpg",
                    "status": ProcessingStatus.READY,
                    "metadata": {"placeholder": True},
                },
            )

        asset.status = ProcessingStatus.READY
        asset.metadata = {
            **asset.metadata,
            "processing": {
                "placeholder_rendition_id": rendition.id,
                "processed_at": timezone.now().isoformat(),
            },
        }
        asset.save(update_fields=["status", "metadata", "updated_at"])
        job.status = ProcessingStatus.READY
        job.completed_at = timezone.now()
        job.log = "Processed Phase 2 placeholder rendition and derivatives."
        job.save(update_fields=["status", "completed_at", "log", "updated_at"])
    except Exception as exc:
        asset.status = ProcessingStatus.FAILED
        asset.save(update_fields=["status", "updated_at"])
        job.status = ProcessingStatus.FAILED
        job.error = str(exc)
        job.completed_at = timezone.now()
        job.save(update_fields=["status", "error", "completed_at", "updated_at"])
        raise

    return job.id
