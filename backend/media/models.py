"""
Media plane (see Master Build Plan §4A): immutable originals + derived
playable variants. The API serves manifests of URLs; bytes live on S3/CDN.
"""
from __future__ import annotations

from django.db import models

from common.models import TimestampedModel


class MediaKind(models.TextChoices):
    AUDIO = "audio", "Audio"
    VIDEO = "video", "Video"
    IMAGE = "image", "Image"


class ProcessingStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    PROCESSING = "processing", "Processing"
    READY = "ready", "Ready"
    FAILED = "failed", "Failed"


class MediaAsset(TimestampedModel):
    """Immutable original uploaded/imported file."""

    kind = models.CharField(max_length=8, choices=MediaKind.choices)
    storage_key = models.CharField(max_length=512, blank=True)
    source_url = models.URLField(max_length=1024, blank=True)
    mime_type = models.CharField(max_length=120, blank=True)
    checksum_sha256 = models.CharField(max_length=64, blank=True)
    size_bytes = models.BigIntegerField(default=0)
    duration_ms = models.PositiveIntegerField(default=0)
    width = models.PositiveIntegerField(null=True, blank=True)
    height = models.PositiveIntegerField(null=True, blank=True)
    processing_status = models.CharField(
        max_length=12, choices=ProcessingStatus.choices, default=ProcessingStatus.PENDING
    )
    processing_error = models.CharField(max_length=300, blank=True)
    processing_log = models.TextField(blank=True)
    processing_attempts = models.PositiveIntegerField(default=0)
    # Provenance
    source_name = models.CharField(max_length=200, blank=True)
    original_filename = models.CharField(max_length=300, blank=True)

    def __str__(self) -> str:
        return f"{self.get_kind_display()} asset #{self.pk}"


class MediaRendition(TimestampedModel):
    """Derived playable variant of a MediaAsset (transcode output)."""

    asset = models.ForeignKey(
        MediaAsset, related_name="variants", on_delete=models.CASCADE
    )
    container = models.CharField(max_length=16)        # opus, aac, mp3, mp4, hls
    bitrate_kbps = models.PositiveIntegerField(null=True, blank=True)
    height = models.PositiveIntegerField(null=True, blank=True)
    codec = models.CharField(max_length=40, blank=True)
    storage_key = models.CharField(max_length=512, blank=True)
    url = models.URLField(max_length=1024, blank=True)
    is_streaming = models.BooleanField(default=True)   # adaptive/online
    is_offline_download = models.BooleanField(default=False)  # progressive single-file for offline
    processing_status = models.CharField(
        max_length=12, choices=ProcessingStatus.choices, default=ProcessingStatus.READY
    )

    class Meta:
        ordering = ["container", "bitrate_kbps"]

    def __str__(self) -> str:
        return f"{self.container} variant of asset #{self.asset_id}"


class Caption(TimestampedModel):
    asset = models.ForeignKey(
        MediaAsset, related_name="captions", on_delete=models.CASCADE
    )
    language_code = models.CharField(max_length=16)
    fmt = models.CharField(max_length=10, default="vtt")
    storage_key = models.CharField(max_length=512, blank=True)
    url = models.URLField(max_length=1024, blank=True)

    def __str__(self) -> str:
        return f"Caption [{self.language_code}] for asset #{self.asset_id}"
