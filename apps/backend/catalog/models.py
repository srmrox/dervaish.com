from django.conf import settings
from django.db import models

from common.models import EditorialModel, EditorialState, TimestampedModel


class PersonRole(models.TextChoices):
    RECITER = "reciter", "Reciter"
    WRITER = "writer", "Writer"
    TRANSLATOR = "translator", "Translator"
    CONTRIBUTOR = "contributor", "Contributor"


class Person(EditorialModel):
    name = models.CharField(max_length=180)
    slug = models.SlugField(max_length=200, unique=True)
    aliases = models.JSONField(default=list, blank=True)
    primary_role = models.CharField(max_length=32, choices=PersonRole.choices, default=PersonRole.CONTRIBUTOR)
    biography = models.TextField(blank=True)
    origin = models.CharField(max_length=160, blank=True)
    external_ids = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class Collection(EditorialModel):
    title = models.CharField(max_length=220)
    slug = models.SlugField(max_length=240, unique=True)
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    is_curated = models.BooleanField(default=False)
    artwork = models.ForeignKey("media.MediaAsset", null=True, blank=True, on_delete=models.SET_NULL)
    share_token = models.CharField(max_length=80, blank=True, unique=True)

    class Meta:
        ordering = ["title"]

    def __str__(self) -> str:
        return self.title


class Track(EditorialModel):
    title = models.CharField(max_length=240)
    slug = models.SlugField(max_length=260, unique=True)
    duration_ms = models.PositiveIntegerField(default=0)
    primary_language_code = models.CharField(max_length=16, default="ur")
    collection = models.ForeignKey(Collection, related_name="tracks", null=True, blank=True, on_delete=models.SET_NULL)
    media_assets = models.ManyToManyField("media.MediaAsset", related_name="tracks", blank=True)
    published_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["title"]
        indexes = [models.Index(fields=["visibility", "published_at"])]

    def __str__(self) -> str:
        return self.title


class TrackCredit(TimestampedModel):
    track = models.ForeignKey(Track, related_name="credits", on_delete=models.CASCADE)
    person = models.ForeignKey(Person, related_name="track_credits", on_delete=models.CASCADE)
    role = models.CharField(max_length=32, choices=PersonRole.choices)
    display_order = models.PositiveIntegerField(default=0)
    note = models.CharField(max_length=240, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["track", "person", "role"], name="unique_track_person_role"),
        ]
        ordering = ["track", "display_order", "person__name"]

    def __str__(self) -> str:
        return f"{self.person} as {self.role} on {self.track}"


class Queue(TimestampedModel):
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, related_name="queues", on_delete=models.CASCADE)
    title = models.CharField(max_length=120)

    def __str__(self) -> str:
        return self.title


class QueueItem(TimestampedModel):
    queue = models.ForeignKey(Queue, related_name="items", on_delete=models.CASCADE)
    track = models.ForeignKey(Track, related_name="queued_items", on_delete=models.CASCADE)
    position = models.PositiveIntegerField()

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["queue", "position"], name="unique_queue_position"),
        ]
        ordering = ["queue", "position"]

    def __str__(self) -> str:
        return f"{self.queue}: {self.track}"


class TrackVote(TimestampedModel):
    track = models.ForeignKey(Track, related_name="votes", on_delete=models.CASCADE)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, related_name="track_votes", on_delete=models.CASCADE)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["track", "user"], name="unique_track_vote"),
        ]

    def __str__(self) -> str:
        return f"{self.user} voted for {self.track}"
