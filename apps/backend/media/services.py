from __future__ import annotations

from datetime import timedelta
from hashlib import sha256
from pathlib import PurePosixPath
from uuid import uuid4

import boto3
from botocore.exceptions import BotoCoreError, ClientError
from django.conf import settings
from django.utils import timezone

from .models import MediaAsset, MediaKind, MediaProcessingJob, MediaProcessingJobKind, ProcessingStatus, UploadSession


def infer_media_kind(mime_type: str) -> str:
    if mime_type.startswith("audio/"):
        return MediaKind.AUDIO
    if mime_type.startswith("video/"):
        return MediaKind.VIDEO
    if mime_type.startswith("image/"):
        return MediaKind.IMAGE
    return MediaKind.DOCUMENT


def extension_for_mime(mime_type: str) -> str:
    mapping = {
        "audio/mpeg": "mp3",
        "audio/mp3": "mp3",
        "audio/ogg": "ogg",
        "audio/opus": "opus",
        "audio/wav": "wav",
        "audio/flac": "flac",
        "video/mp4": "mp4",
        "video/webm": "webm",
        "image/jpeg": "jpg",
        "image/png": "png",
        "text/vtt": "vtt",
    }
    return mapping.get(mime_type, "bin")


def build_storage_key(kind: str, original_filename: str, mime_type: str) -> str:
    suffix = PurePosixPath(original_filename).suffix.lstrip(".") or extension_for_mime(mime_type)
    return str(PurePosixPath(settings.MEDIA_ORIGINALS_PREFIX) / kind / f"{uuid4().hex}.{suffix}")


def create_upload_session(*, user, title: str, original_filename: str, mime_type: str, size_bytes: int, checksum_sha256: str = "") -> UploadSession:
    kind = infer_media_kind(mime_type)
    storage_key = build_storage_key(kind, original_filename, mime_type)
    asset = MediaAsset.objects.create(
        title=title,
        kind=kind,
        storage_key=storage_key,
        original_filename=original_filename,
        mime_type=mime_type,
        size_bytes=size_bytes,
        checksum_sha256=checksum_sha256,
        status=ProcessingStatus.PENDING,
        uploaded_by=user if getattr(user, "is_authenticated", False) else None,
        metadata={"upload": {"expected_mime_type": mime_type}},
    )
    expires_at = timezone.now() + timedelta(minutes=settings.MEDIA_UPLOAD_URL_TTL_MINUTES)
    upload_url = presigned_put_url(storage_key, mime_type, settings.MEDIA_UPLOAD_URL_TTL_MINUTES * 60)
    return UploadSession.objects.create(
        asset=asset,
        upload_url=upload_url,
        expires_at=expires_at,
        expected_checksum_sha256=checksum_sha256,
        expected_size_bytes=size_bytes,
    )


def presigned_put_url(storage_key: str, mime_type: str, expires_in: int) -> str:
    if not settings.MEDIA_ENABLE_PRESIGNED_UPLOADS:
        return f"{settings.MEDIA_LOCAL_UPLOAD_BASE_URL.rstrip('/')}/{storage_key}"

    client = boto3.client(
        "s3",
        endpoint_url=settings.AWS_S3_ENDPOINT_URL,
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        region_name=settings.AWS_S3_REGION_NAME,
    )
    try:
        return client.generate_presigned_url(
            ClientMethod="put_object",
            Params={
                "Bucket": settings.AWS_STORAGE_BUCKET_NAME,
                "Key": storage_key,
                "ContentType": mime_type,
            },
            ExpiresIn=expires_in,
        )
    except (BotoCoreError, ClientError):
        return f"{settings.MEDIA_LOCAL_UPLOAD_BASE_URL.rstrip('/')}/{storage_key}"


def public_media_url(storage_key: str) -> str:
    return f"{settings.MEDIA_PUBLIC_BASE_URL.rstrip('/')}/{storage_key}"


def verify_checksum_bytes(content: bytes, expected_checksum: str) -> bool:
    if not expected_checksum:
        return True
    return sha256(content).hexdigest().lower() == expected_checksum.lower()


def queue_asset_processing(asset: MediaAsset) -> MediaProcessingJob:
    job = MediaProcessingJob.objects.create(asset=asset, kind=MediaProcessingJobKind.INGEST, status=ProcessingStatus.PENDING)
    try:
        from .tasks import process_media_asset

        result = process_media_asset.delay(job.id)
        job.celery_task_id = result.id
        job.save(update_fields=["celery_task_id", "updated_at"])
        job.refresh_from_db()
    except Exception as exc:
        job.log = f"Queued for manual/local processing because Celery dispatch failed: {exc}"
        job.save(update_fields=["log", "updated_at"])
    return job
