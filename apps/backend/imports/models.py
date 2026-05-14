from django.conf import settings
from django.db import models

from common.models import TimestampedModel


class ImportSource(models.TextChoices):
    DERVAISH_PROTOTYPE = "dervaish_prototype", "Dervaish prototype"
    MEDIACMS = "mediacms", "MediaCMS"
    OMEKA_S = "omeka_s", "Omeka S"


class ImportBatchStatus(models.TextChoices):
    DRAFT = "draft", "Draft"
    DRY_RUN = "dry_run", "Dry run"
    RUNNING = "running", "Running"
    COMPLETED = "completed", "Completed"
    FAILED = "failed", "Failed"


class ImportBatch(TimestampedModel):
    source = models.CharField(max_length=32, choices=ImportSource.choices)
    status = models.CharField(max_length=24, choices=ImportBatchStatus.choices, default=ImportBatchStatus.DRAFT)
    dry_run = models.BooleanField(default=True)
    source_label = models.CharField(max_length=180, blank=True)
    payload = models.JSONField(default=dict, blank=True)
    summary = models.JSONField(default=dict, blank=True)
    error = models.TextField(blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)

    class Meta:
        indexes = [models.Index(fields=["source", "status", "created_at"])]
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.source} import {self.id}"
