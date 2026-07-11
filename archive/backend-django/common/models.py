"""Shared base models and enums reused across Dervaish apps."""
from __future__ import annotations

from django.db import models


class Visibility(models.TextChoices):
    DRAFT = "draft", "Draft"
    PENDING = "pending", "Pending review"
    PUBLIC = "public", "Public"
    UNLISTED = "unlisted", "Unlisted"
    ARCHIVED = "archived", "Archived"


class EditorialState(models.TextChoices):
    DRAFT = "draft", "Draft"
    IN_REVIEW = "in_review", "In review"
    PUBLISHED = "published", "Published"
    REJECTED = "rejected", "Rejected"


class TimestampedModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class EditorialModel(TimestampedModel):
    """Base for reviewable, publishable archive entities."""

    visibility = models.CharField(
        max_length=16, choices=Visibility.choices, default=Visibility.DRAFT
    )
    state = models.CharField(
        max_length=16, choices=EditorialState.choices, default=EditorialState.DRAFT
    )
    editorial_notes = models.TextField(blank=True)

    class Meta:
        abstract = True

    @property
    def is_public(self) -> bool:
        return self.visibility in {Visibility.PUBLIC, Visibility.UNLISTED}
