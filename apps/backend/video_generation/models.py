from django.conf import settings
from django.db import models

from common.models import TimestampedModel


class VideoGenerationStatus(models.TextChoices):
    QUEUED = "queued", "Queued"
    RUNNING = "running", "Running"
    COMPLETED = "completed", "Completed"
    FAILED = "failed", "Failed"
    CANCELLED = "cancelled", "Cancelled"


class VideoGenerationSourceMode(models.TextChoices):
    AUDIO_VISUALIZER = "audio_visualizer", "Audio visualizer"
    VIDEO_OVERLAY = "video_overlay", "Video overlay"


class VideoGenerationResolution(models.TextChoices):
    P720 = "720p", "720p"
    P1080 = "1080p", "1080p"
    P4K = "4k", "4K"


class VideoGenerationJob(TimestampedModel):
    requested_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    submission = models.ForeignKey("community.Submission", related_name="video_generation_jobs", null=True, blank=True, on_delete=models.SET_NULL)
    track = models.ForeignKey("catalog.Track", related_name="video_generation_jobs", null=True, blank=True, on_delete=models.SET_NULL)
    source_asset = models.ForeignKey("media.MediaAsset", related_name="video_generation_jobs", on_delete=models.PROTECT)
    lyric_set = models.ForeignKey("lyrics.LyricSet", related_name="video_generation_jobs", null=True, blank=True, on_delete=models.SET_NULL)
    source_mode = models.CharField(max_length=32, choices=VideoGenerationSourceMode.choices)
    layout_id = models.CharField(max_length=80, default="landscape-1")
    resolution = models.CharField(max_length=16, choices=VideoGenerationResolution.choices, default=VideoGenerationResolution.P1080)
    visible_language_ids = models.JSONField(default=list, blank=True)
    title = models.CharField(max_length=240)
    voice = models.CharField(max_length=180, blank=True)
    writer = models.CharField(max_length=180, blank=True)
    status = models.CharField(max_length=24, choices=VideoGenerationStatus.choices, default=VideoGenerationStatus.QUEUED)
    log = models.TextField(blank=True)
    failure_reason = models.TextField(blank=True)
    preview_asset = models.ForeignKey("media.MediaAsset", related_name="video_preview_jobs", null=True, blank=True, on_delete=models.SET_NULL)
    output_asset = models.ForeignKey("media.MediaAsset", related_name="video_output_jobs", null=True, blank=True, on_delete=models.SET_NULL)

    class Meta:
        indexes = [models.Index(fields=["status", "created_at"])]

    def __str__(self) -> str:
        return self.title
