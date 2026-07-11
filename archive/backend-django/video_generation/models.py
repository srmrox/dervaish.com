from __future__ import annotations

from django.conf import settings
from django.db import models

from common.models import TimestampedModel


class VideoGenerationJob(TimestampedModel):
    class Status(models.TextChoices):
        QUEUED = "queued", "Queued"
        RUNNING = "running", "Running"
        COMPLETED = "completed", "Completed"
        FAILED = "failed", "Failed"
        CANCELLED = "cancelled", "Cancelled"

    class SourceMode(models.TextChoices):
        AUDIO_VISUALIZER = "audio_visualizer", "Audio visualizer"
        VIDEO_OVERLAY = "video_overlay", "Video overlay"

    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL
    )
    rendition = models.ForeignKey(
        "catalog.Rendition", null=True, blank=True, on_delete=models.SET_NULL,
        related_name="video_jobs",
    )
    source_mode = models.CharField(
        max_length=24, choices=SourceMode.choices, default=SourceMode.AUDIO_VISUALIZER
    )
    layout_id = models.CharField(max_length=80, default="landscape-1")
    resolution = models.CharField(max_length=16, default="1080p")
    visible_language_codes = models.JSONField(default=list, blank=True)
    title = models.CharField(max_length=240, blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.QUEUED)
    celery_task_id = models.CharField(max_length=120, blank=True)
    render_payload = models.JSONField(default=dict, blank=True)
    log = models.TextField(blank=True)
    failure_reason = models.TextField(blank=True)
    output_url = models.URLField(max_length=1024, blank=True)
    published_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["status", "created_at"])]

    def __str__(self) -> str:
        return self.title or f"job #{self.pk}"
