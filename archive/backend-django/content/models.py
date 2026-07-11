"""Wiki prose annotations + the DB→Git Markdown publish log (plan §4)."""
from __future__ import annotations

from django.db import models

from common.models import TimestampedModel


class Annotation(TimestampedModel):
    class Target(models.TextChoices):
        KALAM = "kalam", "Kalam"
        VERSE = "verse", "Verse"
        RENDITION = "rendition", "Rendition"

    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        SUBMITTED = "submitted", "Submitted"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"

    target_kind = models.CharField(max_length=16, choices=Target.choices)
    kalam = models.ForeignKey(
        "catalog.Kalam", null=True, blank=True, on_delete=models.CASCADE, related_name="annotations"
    )
    verse = models.ForeignKey(
        "catalog.Verse", null=True, blank=True, on_delete=models.CASCADE, related_name="annotations"
    )
    rendition = models.ForeignKey(
        "catalog.Rendition", null=True, blank=True, on_delete=models.CASCADE, related_name="annotations"
    )
    language_code = models.CharField(max_length=16, default="en")
    body_markdown = models.TextField(blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.DRAFT)

    def __str__(self) -> str:
        return f"{self.target_kind} annotation #{self.pk}"


class PublishedFile(TimestampedModel):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        COMMITTED = "committed", "Committed"
        FAILED = "failed", "Failed"

    entity_type = models.CharField(max_length=40)
    entity_id = models.CharField(max_length=64)
    repo_path = models.CharField(max_length=512)
    content_hash = models.CharField(max_length=64, blank=True)
    commit_sha = models.CharField(max_length=64, blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PENDING)
    published_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["entity_type", "entity_id"])]

    def __str__(self) -> str:
        return self.repo_path
