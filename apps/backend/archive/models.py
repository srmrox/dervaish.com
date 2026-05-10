from django.db import models

from common.models import EditorialModel, TimestampedModel


class CitationType(models.TextChoices):
    INTERVIEW = "interview", "Interview"
    BOOK = "book", "Book"
    FIELD_RECORDING = "field_recording", "Field recording"
    WEBSITE = "website", "Website"
    MANUSCRIPT = "manuscript", "Manuscript"


class VocabularyTerm(TimestampedModel):
    vocabulary = models.CharField(max_length=120)
    code = models.CharField(max_length=120)
    label = models.CharField(max_length=180)
    uri = models.URLField(blank=True)
    description = models.TextField(blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["vocabulary", "code"], name="unique_vocabulary_code"),
        ]
        ordering = ["vocabulary", "label"]

    def __str__(self) -> str:
        return f"{self.vocabulary}: {self.label}"


class Citation(TimestampedModel):
    title = models.CharField(max_length=260)
    source_type = models.CharField(max_length=32, choices=CitationType.choices)
    author = models.CharField(max_length=180, blank=True)
    published_at = models.CharField(max_length=80, blank=True)
    url = models.URLField(blank=True)
    note = models.TextField(blank=True)

    def __str__(self) -> str:
        return self.title


class ArchiveRecord(EditorialModel):
    title = models.CharField(max_length=260)
    slug = models.SlugField(max_length=280, unique=True)
    summary = models.TextField()
    editorial_notes = models.TextField(blank=True)
    contributor_notes = models.JSONField(default=list, blank=True)
    tracks = models.ManyToManyField("catalog.Track", related_name="archive_records", blank=True)
    people = models.ManyToManyField("catalog.Person", related_name="archive_records", blank=True)
    collections = models.ManyToManyField("catalog.Collection", related_name="archive_records", blank=True)
    citations = models.ManyToManyField(Citation, related_name="archive_records", blank=True)
    terms = models.ManyToManyField(VocabularyTerm, related_name="archive_records", blank=True)

    class Meta:
        ordering = ["title"]
        indexes = [models.Index(fields=["visibility"])]

    def __str__(self) -> str:
        return self.title


class ProvenanceRecord(TimestampedModel):
    archive_record = models.ForeignKey(ArchiveRecord, related_name="provenance_records", null=True, blank=True, on_delete=models.CASCADE)
    media_asset = models.ForeignKey("media.MediaAsset", related_name="provenance_records", null=True, blank=True, on_delete=models.CASCADE)
    event_type = models.CharField(max_length=80)
    source_name = models.CharField(max_length=180, blank=True)
    source_url = models.URLField(blank=True)
    source_identifier = models.CharField(max_length=180, blank=True)
    checksum_sha256 = models.CharField(max_length=64, blank=True)
    note = models.TextField(blank=True)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        indexes = [models.Index(fields=["event_type", "created_at"])]

    def __str__(self) -> str:
        return self.event_type


class SourceRating(TimestampedModel):
    class RatingKind(models.TextChoices):
        EDITORIAL = "editorial", "Editorial"
        COMMUNITY = "community", "Community"

    archive_record = models.ForeignKey(ArchiveRecord, related_name="source_ratings", on_delete=models.CASCADE)
    kind = models.CharField(max_length=24, choices=RatingKind.choices)
    value = models.PositiveSmallIntegerField(default=0)
    max_value = models.PositiveSmallIntegerField(default=5)
    rationale = models.TextField()
    contributor = models.ForeignKey("accounts.User", null=True, blank=True, on_delete=models.SET_NULL)

    def __str__(self) -> str:
        return f"{self.value}/{self.max_value} {self.kind}"
