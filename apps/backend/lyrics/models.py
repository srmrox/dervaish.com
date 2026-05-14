from django.core.exceptions import ValidationError
from django.conf import settings
from django.db import models

from common.models import ReviewState, TimestampedModel


class LyricDirection(models.TextChoices):
    LTR = "ltr", "Left to right"
    RTL = "rtl", "Right to left"


class LyricLanguageRole(models.TextChoices):
    ORIGINAL = "original", "Original"
    TRANSLATION = "translation", "Translation"
    TRANSLITERATION = "transliteration", "Transliteration"
    COMMENTARY = "commentary", "Commentary"


class LyricSet(TimestampedModel):
    track = models.ForeignKey("catalog.Track", related_name="lyric_sets", null=True, blank=True, on_delete=models.CASCADE)
    title = models.CharField(max_length=180, blank=True)
    source = models.CharField(max_length=40, default="canonical")
    status = models.CharField(max_length=32, choices=ReviewState.choices, default=ReviewState.DRAFT)
    version = models.PositiveIntegerField(default=1)
    is_canonical = models.BooleanField(default=False)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["track"],
                condition=models.Q(is_canonical=True),
                name="unique_canonical_lyric_set_per_track",
            ),
        ]

    def __str__(self) -> str:
        return self.title or f"Lyric set {self.pk}"


class LyricLanguage(TimestampedModel):
    lyric_set = models.ForeignKey(LyricSet, related_name="languages", on_delete=models.CASCADE)
    code = models.CharField(max_length=16)
    name = models.CharField(max_length=120)
    role = models.CharField(max_length=32, choices=LyricLanguageRole.choices)
    direction = models.CharField(max_length=8, choices=LyricDirection.choices)
    display_order = models.PositiveIntegerField(default=0)
    is_published = models.BooleanField(default=False)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["lyric_set", "code", "role"], name="unique_lyric_language_role"),
        ]
        ordering = ["lyric_set", "display_order", "name"]

    def __str__(self) -> str:
        return f"{self.name} ({self.role})"


class LyricSegment(TimestampedModel):
    lyric_set = models.ForeignKey(LyricSet, related_name="segments", on_delete=models.CASCADE)
    start_ms = models.PositiveIntegerField()
    end_ms = models.PositiveIntegerField()
    text_by_language = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["lyric_set", "start_ms"]
        indexes = [models.Index(fields=["lyric_set", "start_ms", "end_ms"])]

    def clean(self) -> None:
        if self.end_ms <= self.start_ms:
            raise ValidationError({"end_ms": "End time must be greater than start time."})

    def __str__(self) -> str:
        return f"{self.start_ms}-{self.end_ms}"


class UserLyricPreference(TimestampedModel):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, related_name="lyric_preferences", on_delete=models.CASCADE)
    track = models.ForeignKey("catalog.Track", related_name="lyric_preferences", on_delete=models.CASCADE)
    visible_language_ids = models.JSONField(default=list, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["user", "track"], name="unique_user_track_lyric_preference"),
        ]
        indexes = [models.Index(fields=["user", "track"])]

    def __str__(self) -> str:
        return f"{self.user} lyric preferences for {self.track}"
