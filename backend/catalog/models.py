"""
Catalogue core (Master Build Plan §7). Archive-first model:

    Person ──authored──► Kalam ──has ordered──► Verse
                           │ has many
                           ▼
                        Rendition ──has media──► media.MediaAsset
                  performed by Person (via Credit)

A Kalam is the work; a Rendition is one performance; audio/video attaches to
the Rendition.
"""
from __future__ import annotations

from django.conf import settings
from django.db import models

from common.models import EditorialModel, TimestampedModel


# --- People -----------------------------------------------------------------
class PersonRole(models.TextChoices):
    AUTHOR = "author", "Author / poet"
    RECITER = "reciter", "Reciter / voice artist"
    COMPOSER = "composer", "Composer"
    TRANSLATOR = "translator", "Translator"
    CONTRIBUTOR = "contributor", "Contributor"


class Person(EditorialModel):
    name = models.CharField(max_length=200)
    name_native = models.CharField(max_length=200, blank=True)
    slug = models.SlugField(max_length=220, unique=True)
    aliases = models.JSONField(default=list, blank=True)
    biography = models.TextField(blank=True)
    era = models.CharField(max_length=120, blank=True)
    region = models.CharField(max_length=160, blank=True)
    tradition = models.ForeignKey(
        "taxonomy.VocabularyTerm", null=True, blank=True,
        on_delete=models.SET_NULL, related_name="people",
    )
    portrait = models.ForeignKey(
        "media.MediaAsset", null=True, blank=True,
        on_delete=models.SET_NULL, related_name="portrait_of",
    )
    external_ids = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


# --- Kalam (the work) -------------------------------------------------------
class Kalam(EditorialModel):
    title = models.CharField(max_length=260)
    title_native = models.CharField(max_length=260, blank=True)
    title_transliterated = models.CharField(max_length=260, blank=True)
    slug = models.SlugField(max_length=280, unique=True)

    author = models.ForeignKey(
        Person, null=True, blank=True, on_delete=models.SET_NULL, related_name="authored_kalams"
    )
    primary_language = models.ForeignKey(
        "taxonomy.VocabularyTerm", null=True, blank=True, on_delete=models.SET_NULL,
        related_name="kalams_primary", limit_choices_to={"kind": "language"},
    )
    genre = models.ForeignKey(
        "taxonomy.VocabularyTerm", null=True, blank=True, on_delete=models.SET_NULL,
        related_name="kalams_genre", limit_choices_to={"kind": "genre"},
    )
    tradition = models.ForeignKey(
        "taxonomy.VocabularyTerm", null=True, blank=True, on_delete=models.SET_NULL,
        related_name="kalams_tradition", limit_choices_to={"kind": "tradition"},
    )
    era = models.CharField(max_length=120, blank=True)
    themes = models.ManyToManyField(
        "taxonomy.VocabularyTerm", blank=True, related_name="kalams_themed",
        limit_choices_to={"kind": "theme"},
    )
    tags = models.JSONField(default=list, blank=True)
    summary = models.TextField(blank=True)
    published_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["title"]
        indexes = [models.Index(fields=["visibility", "published_at"])]

    def __str__(self) -> str:
        return self.title


class Verse(TimestampedModel):
    """Ordered line/verse of a Kalam. Carries text + translations + meaning.

    This is the unit that powers both the reader view and synced lyrics.
    """

    kalam = models.ForeignKey(Kalam, related_name="verses", on_delete=models.CASCADE)
    order = models.PositiveIntegerField(default=0)
    text_native = models.TextField(blank=True)
    transliteration = models.TextField(blank=True)
    # translations: {"en": "...", "ur": "..."}; meaning: {"en": "..."}
    translations = models.JSONField(default=dict, blank=True)
    meaning = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["kalam", "order"]
        constraints = [
            models.UniqueConstraint(fields=["kalam", "order"], name="unique_verse_order"),
        ]

    def __str__(self) -> str:
        return f"{self.kalam} · verse {self.order}"


# --- Rendition (a performance) ---------------------------------------------
class ProtectionLevel(models.TextChoices):
    OPEN = "open", "Open (public CDN, app-private offline)"
    SIGNED = "signed", "Signed/expiring URLs"
    DRM = "drm", "Platform DRM"


class Rendition(EditorialModel):
    kalam = models.ForeignKey(Kalam, related_name="renditions", on_delete=models.CASCADE)
    title = models.CharField(max_length=260, blank=True)  # optional override
    slug = models.SlugField(max_length=280, unique=True)
    duration_ms = models.PositiveIntegerField(default=0)
    year = models.PositiveIntegerField(null=True, blank=True)
    album = models.CharField(max_length=240, blank=True)
    publisher = models.CharField(max_length=240, blank=True)
    style = models.CharField(max_length=240, blank=True)

    media_assets = models.ManyToManyField(
        "media.MediaAsset", blank=True, related_name="renditions"
    )
    protection_level = models.CharField(
        max_length=8, choices=ProtectionLevel.choices, default=ProtectionLevel.OPEN
    )
    rights_note = models.CharField(max_length=300, blank=True)
    published_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["kalam", "year"]
        indexes = [models.Index(fields=["visibility", "published_at"])]

    def __str__(self) -> str:
        return self.title or f"Rendition of {self.kalam}"


# --- Credits (typed Person↔Kalam/Rendition) --------------------------------
class Credit(TimestampedModel):
    person = models.ForeignKey(Person, related_name="credits", on_delete=models.CASCADE)
    role = models.CharField(max_length=16, choices=PersonRole.choices)
    kalam = models.ForeignKey(
        Kalam, null=True, blank=True, related_name="credits", on_delete=models.CASCADE
    )
    rendition = models.ForeignKey(
        Rendition, null=True, blank=True, related_name="credits", on_delete=models.CASCADE
    )
    display_order = models.PositiveIntegerField(default=0)
    note = models.CharField(max_length=240, blank=True)

    class Meta:
        ordering = ["display_order", "person__name"]

    def __str__(self) -> str:
        target = self.rendition or self.kalam
        return f"{self.person} as {self.get_role_display()} on {target}"


# --- Collections / playlists / queues --------------------------------------
class Collection(EditorialModel):
    title = models.CharField(max_length=240)
    slug = models.SlugField(max_length=260, unique=True)
    description = models.TextField(blank=True)
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="collections",
    )
    is_curated = models.BooleanField(default=False)
    artwork = models.ForeignKey(
        "media.MediaAsset", null=True, blank=True,
        on_delete=models.SET_NULL, related_name="collection_artwork",
    )
    share_token = models.CharField(max_length=80, blank=True)
    renditions = models.ManyToManyField(
        Rendition, through="CollectionItem", related_name="collections"
    )

    class Meta:
        ordering = ["title"]

    def __str__(self) -> str:
        return self.title


class CollectionItem(TimestampedModel):
    collection = models.ForeignKey(Collection, related_name="items", on_delete=models.CASCADE)
    rendition = models.ForeignKey(Rendition, on_delete=models.CASCADE)
    position = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["collection", "position"]
        constraints = [
            models.UniqueConstraint(
                fields=["collection", "rendition"], name="unique_collection_rendition"
            ),
        ]
