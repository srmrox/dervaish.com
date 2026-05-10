from django.conf import settings
from django.db import models

from common.models import ReviewState, TimestampedModel


class CorrectionField(models.TextChoices):
    LYRICS = "lyrics", "Lyrics"
    WRITER = "writer", "Writer"
    RECITER = "reciter", "Reciter"
    SOURCE = "source", "Source"
    METADATA = "metadata", "Metadata"
    MEDIA = "media", "Media"


class Submission(TimestampedModel):
    submitter = models.ForeignKey(settings.AUTH_USER_MODEL, related_name="submissions", null=True, blank=True, on_delete=models.SET_NULL)
    title = models.CharField(max_length=240)
    voice = models.CharField(max_length=180, blank=True)
    writer = models.CharField(max_length=180, blank=True)
    source_name = models.CharField(max_length=240, blank=True)
    notes = models.TextField(blank=True)
    status = models.CharField(max_length=32, choices=ReviewState.choices, default=ReviewState.DRAFT)
    citations = models.ManyToManyField("archive.Citation", related_name="submissions", blank=True)
    media_assets = models.ManyToManyField("media.MediaAsset", related_name="submissions", blank=True)
    lyric_set = models.ForeignKey("lyrics.LyricSet", related_name="submissions", null=True, blank=True, on_delete=models.SET_NULL)
    reviewed_by = models.ForeignKey(settings.AUTH_USER_MODEL, related_name="reviewed_submissions", null=True, blank=True, on_delete=models.SET_NULL)
    reviewed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        indexes = [models.Index(fields=["status", "created_at"])]

    def __str__(self) -> str:
        return self.title


class CorrectionDraft(TimestampedModel):
    submission = models.ForeignKey(Submission, related_name="correction_drafts", on_delete=models.CASCADE)
    target_track = models.ForeignKey("catalog.Track", related_name="correction_drafts", null=True, blank=True, on_delete=models.CASCADE)
    target_archive_record = models.ForeignKey("archive.ArchiveRecord", related_name="correction_drafts", null=True, blank=True, on_delete=models.CASCADE)
    fields = models.JSONField(default=list, blank=True)
    proposed_changes = models.JSONField(default=dict, blank=True)
    status = models.CharField(max_length=32, choices=ReviewState.choices, default=ReviewState.DRAFT)

    def __str__(self) -> str:
        return f"Correction for {self.target_track or self.target_archive_record}"


class VerificationField(models.TextChoices):
    WRITER = "writer", "Writer"
    RECITER = "reciter", "Reciter"
    LYRICS = "lyrics", "Lyrics"
    SOURCE = "source", "Source"
    OVERALL = "overall", "Overall"


class VerificationVoteValue(models.TextChoices):
    VERIFY = "verify", "Verify"
    DISPUTE = "dispute", "Dispute"


class VerificationVote(TimestampedModel):
    submission = models.ForeignKey(Submission, related_name="verification_votes", on_delete=models.CASCADE)
    voter = models.ForeignKey(settings.AUTH_USER_MODEL, related_name="verification_votes", on_delete=models.CASCADE)
    field = models.CharField(max_length=32, choices=VerificationField.choices)
    vote = models.CharField(max_length=16, choices=VerificationVoteValue.choices)
    note = models.TextField(blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["submission", "voter", "field"], name="unique_submission_field_vote"),
        ]

    def __str__(self) -> str:
        return f"{self.vote} {self.field}"


class TrackRequestStatus(models.TextChoices):
    OPEN = "open", "Open"
    PLANNED = "planned", "Planned"
    FULFILLED = "fulfilled", "Fulfilled"
    DUPLICATE = "duplicate", "Duplicate"
    REJECTED = "rejected", "Rejected"


class TrackRequest(TimestampedModel):
    requester = models.ForeignKey(settings.AUTH_USER_MODEL, related_name="track_requests", null=True, blank=True, on_delete=models.SET_NULL)
    title = models.CharField(max_length=240, blank=True)
    target_track = models.ForeignKey("catalog.Track", related_name="track_requests", null=True, blank=True, on_delete=models.SET_NULL)
    reciter_name = models.CharField(max_length=180, blank=True)
    writer_name = models.CharField(max_length=180, blank=True)
    source_hint = models.TextField(blank=True)
    status = models.CharField(max_length=24, choices=TrackRequestStatus.choices, default=TrackRequestStatus.OPEN)
    moderator_note = models.TextField(blank=True)

    class Meta:
        indexes = [models.Index(fields=["status", "created_at"])]

    def __str__(self) -> str:
        return self.title or str(self.target_track)


class TrackRequestVote(TimestampedModel):
    request = models.ForeignKey(TrackRequest, related_name="votes", on_delete=models.CASCADE)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, related_name="track_request_votes", on_delete=models.CASCADE)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["request", "user"], name="unique_track_request_vote"),
        ]

    def __str__(self) -> str:
        return f"{self.user} voted for {self.request}"
