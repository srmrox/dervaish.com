"""Community workflow (v1 minimal): submissions, requests, upvotes."""
from __future__ import annotations

from django.conf import settings
from django.db import models

from common.models import TimestampedModel


class Submission(TimestampedModel):
    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        SUBMITTED = "submitted", "Submitted"
        IN_REVIEW = "in_review", "Under review"
        CHANGES = "changes_requested", "Changes requested"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"
        PUBLISHED = "published", "Published"

    author = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="submissions",
    )
    title = models.CharField(max_length=260)
    payload = models.JSONField(default=dict, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    reviewer_note = models.TextField(blank=True)

    def __str__(self) -> str:
        return f"{self.title} [{self.get_status_display()}]"


class KalamRequest(TimestampedModel):
    class Status(models.TextChoices):
        OPEN = "open", "Open"
        PLANNED = "planned", "Planned"
        FULFILLED = "fulfilled", "Fulfilled"
        REJECTED = "rejected", "Rejected"

    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="kalam_requests",
    )
    title = models.CharField(max_length=260)
    details = models.TextField(blank=True)
    author_hint = models.CharField(max_length=200, blank=True)
    reciter_hint = models.CharField(max_length=200, blank=True)
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.OPEN)

    def __str__(self) -> str:
        return self.title


class RequestUpvote(TimestampedModel):
    request = models.ForeignKey(KalamRequest, related_name="upvotes", on_delete=models.CASCADE)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["request", "user"], name="unique_request_upvote"),
        ]
