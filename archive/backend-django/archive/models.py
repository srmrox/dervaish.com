"""Source-critical archive layer: records, citations, provenance, ratings."""
from __future__ import annotations

from django.db import models

from common.models import EditorialModel, TimestampedModel


class Citation(TimestampedModel):
    class SourceType(models.TextChoices):
        BOOK = "book", "Book"
        MANUSCRIPT = "manuscript", "Manuscript"
        WEBSITE = "website", "Website"
        INTERVIEW = "interview", "Interview"
        FIELD = "field_recording", "Field recording"

    title = models.CharField(max_length=300)
    source_type = models.CharField(max_length=20, choices=SourceType.choices)
    author = models.CharField(max_length=200, blank=True)
    published_at = models.CharField(max_length=60, blank=True)
    url = models.URLField(max_length=1024, blank=True)
    note = models.TextField(blank=True)

    def __str__(self) -> str:
        return self.title


class ArchiveRecord(EditorialModel):
    title = models.CharField(max_length=300)
    slug = models.SlugField(max_length=320, unique=True)
    summary = models.TextField(blank=True)
    kalam = models.ForeignKey(
        "catalog.Kalam", null=True, blank=True,
        on_delete=models.SET_NULL, related_name="archive_records",
    )
    related_people = models.ManyToManyField("catalog.Person", blank=True, related_name="archive_records")
    citations = models.ManyToManyField(Citation, blank=True, related_name="records")
    contributor_notes = models.JSONField(default=list, blank=True)

    def __str__(self) -> str:
        return self.title


class ProvenanceRecord(TimestampedModel):
    archive_record = models.ForeignKey(
        ArchiveRecord, related_name="provenance", on_delete=models.CASCADE
    )
    source_name = models.CharField(max_length=200)
    source_url = models.URLField(max_length=1024, blank=True)
    acquired_at = models.DateField(null=True, blank=True)
    checksum_sha256 = models.CharField(max_length=64, blank=True)
    note = models.TextField(blank=True)

    def __str__(self) -> str:
        return f"Provenance: {self.source_name}"


class SourceRating(TimestampedModel):
    class Kind(models.TextChoices):
        EDITORIAL = "editorial", "Editorial"
        COMMUNITY = "community", "Community"

    archive_record = models.ForeignKey(
        ArchiveRecord, related_name="ratings", on_delete=models.CASCADE
    )
    kind = models.CharField(max_length=12, choices=Kind.choices)
    value = models.PositiveSmallIntegerField()
    max_value = models.PositiveSmallIntegerField(default=5)
    rationale = models.TextField(blank=True)

    def __str__(self) -> str:
        return f"{self.get_kind_display()} {self.value}/{self.max_value}"
