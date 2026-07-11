from django.db import models

from common.models import TimestampedModel


class TermKind(models.TextChoices):
    GENRE = "genre", "Genre / form"          # hamd, naat, manqabat, qawwali, kafi...
    LANGUAGE = "language", "Language"
    TRADITION = "tradition", "Tradition / silsila"
    ERA = "era", "Era"
    THEME = "theme", "Theme / occasion"
    REGION = "region", "Region"


class VocabularyTerm(TimestampedModel):
    """Controlled vocabulary reused across kalams, renditions, and people."""

    kind = models.CharField(max_length=16, choices=TermKind.choices)
    code = models.SlugField(max_length=80)
    label = models.CharField(max_length=160)
    label_native = models.CharField(max_length=160, blank=True)
    description = models.TextField(blank=True)
    parent = models.ForeignKey(
        "self", null=True, blank=True, on_delete=models.SET_NULL, related_name="children"
    )

    class Meta:
        ordering = ["kind", "label"]
        constraints = [
            models.UniqueConstraint(fields=["kind", "code"], name="unique_term_kind_code"),
        ]

    def __str__(self) -> str:
        return f"{self.get_kind_display()}: {self.label}"
