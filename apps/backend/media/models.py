from django.conf import settings
from django.db import models

from common.models import TimestampedModel


class MediaKind(models.TextChoices):
    AUDIO = "audio", "Audio"
    VIDEO = "video", "Video"
    IMAGE = "image", "Image"
    DOCUMENT = "document", "Document"


class ProcessingStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    PROCESSING = "processing", "Processing"
    READY = "ready", "Ready"
    FAILED = "failed", "Failed"


class UploadSessionStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    UPLOADED = "uploaded", "Uploaded"
    CANCELLED = "cancelled", "Cancelled"
    EXPIRED = "expired", "Expired"


class MediaProcessingJobKind(models.TextChoices):
    INGEST = "ingest", "Ingest"
    TRANSCODE = "transcode", "Transcode"
    THUMBNAIL = "thumbnail", "Thumbnail"
    WAVEFORM = "waveform", "Waveform"


class MediaAsset(TimestampedModel):
    title = models.CharField(max_length=240, blank=True)
    kind = models.CharField(max_length=24, choices=MediaKind.choices)
    storage_key = models.CharField(max_length=512)
    original_filename = models.CharField(max_length=255, blank=True)
    mime_type = models.CharField(max_length=120, blank=True)
    checksum_sha256 = models.CharField(max_length=64, blank=True)
    size_bytes = models.PositiveBigIntegerField(default=0)
    duration_ms = models.PositiveIntegerField(default=0)
    width = models.PositiveIntegerField(null=True, blank=True)
    height = models.PositiveIntegerField(null=True, blank=True)
    source_url = models.URLField(blank=True)
    is_master = models.BooleanField(default=True)
    status = models.CharField(max_length=24, choices=ProcessingStatus.choices, default=ProcessingStatus.PENDING)
    uploaded_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=["kind", "status"]),
            models.Index(fields=["checksum_sha256"]),
        ]

    def __str__(self) -> str:
        return self.title or self.original_filename or self.storage_key


class UploadSession(TimestampedModel):
    asset = models.OneToOneField(MediaAsset, related_name="upload_session", on_delete=models.CASCADE)
    status = models.CharField(max_length=24, choices=UploadSessionStatus.choices, default=UploadSessionStatus.PENDING)
    upload_url = models.URLField(max_length=1200, blank=True)
    expires_at = models.DateTimeField()
    expected_checksum_sha256 = models.CharField(max_length=64, blank=True)
    expected_size_bytes = models.PositiveBigIntegerField(default=0)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        indexes = [models.Index(fields=["status", "expires_at"])]

    def __str__(self) -> str:
        return f"Upload session for {self.asset}"


class MediaRendition(TimestampedModel):
    asset = models.ForeignKey(MediaAsset, related_name="renditions", on_delete=models.CASCADE)
    format = models.CharField(max_length=32)
    codec = models.CharField(max_length=80, blank=True)
    bitrate_kbps = models.PositiveIntegerField(null=True, blank=True)
    width = models.PositiveIntegerField(null=True, blank=True)
    height = models.PositiveIntegerField(null=True, blank=True)
    storage_key = models.CharField(max_length=512)
    size_bytes = models.PositiveBigIntegerField(default=0)
    status = models.CharField(max_length=24, choices=ProcessingStatus.choices, default=ProcessingStatus.PENDING)
    is_playable = models.BooleanField(default=True)

    class Meta:
        indexes = [models.Index(fields=["asset", "status"])]

    def __str__(self) -> str:
        return f"{self.asset} {self.format}"


class MediaDerivative(TimestampedModel):
    class DerivativeKind(models.TextChoices):
        THUMBNAIL = "thumbnail", "Thumbnail"
        WAVEFORM = "waveform", "Waveform"
        PREVIEW = "preview", "Preview"

    asset = models.ForeignKey(MediaAsset, related_name="derivatives", on_delete=models.CASCADE)
    kind = models.CharField(max_length=24, choices=DerivativeKind.choices)
    storage_key = models.CharField(max_length=512)
    format = models.CharField(max_length=32)
    metadata = models.JSONField(default=dict, blank=True)
    status = models.CharField(max_length=24, choices=ProcessingStatus.choices, default=ProcessingStatus.PENDING)

    class Meta:
        indexes = [models.Index(fields=["asset", "kind", "status"])]

    def __str__(self) -> str:
        return f"{self.asset} {self.kind}"


class MediaProcessingJob(TimestampedModel):
    asset = models.ForeignKey(MediaAsset, related_name="processing_jobs", on_delete=models.CASCADE)
    kind = models.CharField(max_length=24, choices=MediaProcessingJobKind.choices)
    status = models.CharField(max_length=24, choices=ProcessingStatus.choices, default=ProcessingStatus.PENDING)
    celery_task_id = models.CharField(max_length=120, blank=True)
    log = models.TextField(blank=True)
    error = models.TextField(blank=True)
    attempts = models.PositiveIntegerField(default=0)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        indexes = [models.Index(fields=["kind", "status", "created_at"])]

    def __str__(self) -> str:
        return f"{self.kind} {self.status} for {self.asset}"


class Caption(TimestampedModel):
    asset = models.ForeignKey(MediaAsset, related_name="captions", null=True, blank=True, on_delete=models.CASCADE)
    track = models.ForeignKey("catalog.Track", related_name="captions", null=True, blank=True, on_delete=models.CASCADE)
    language_code = models.CharField(max_length=16)
    label = models.CharField(max_length=120)
    format = models.CharField(max_length=32, default="webvtt")
    storage_key = models.CharField(max_length=512)
    is_published = models.BooleanField(default=False)

    def __str__(self) -> str:
        return f"{self.label} ({self.language_code})"


class Chapter(TimestampedModel):
    track = models.ForeignKey("catalog.Track", related_name="chapters", on_delete=models.CASCADE)
    title = models.CharField(max_length=180)
    language_code = models.CharField(max_length=16, default="en")
    start_ms = models.PositiveIntegerField()
    end_ms = models.PositiveIntegerField(null=True, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["track", "start_ms"]

    def __str__(self) -> str:
        return self.title
