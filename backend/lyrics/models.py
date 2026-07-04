"""
Synced lyrics (Master Build Plan §7). Timings hang on the Rendition and point
at the Kalam's Verses, so every rendition reuses the same verse text and
translations with its own timing map — no duplicated text.
"""
from __future__ import annotations

from django.db import models

from common.models import TimestampedModel


class RenditionVerseTiming(TimestampedModel):
    rendition = models.ForeignKey(
        "catalog.Rendition", related_name="verse_timings", on_delete=models.CASCADE
    )
    verse = models.ForeignKey(
        "catalog.Verse", related_name="timings", on_delete=models.CASCADE
    )
    start_ms = models.PositiveIntegerField()
    end_ms = models.PositiveIntegerField(null=True, blank=True)

    class Meta:
        ordering = ["rendition", "start_ms"]
        constraints = [
            models.UniqueConstraint(
                fields=["rendition", "verse"], name="unique_rendition_verse_timing"
            ),
        ]

    def __str__(self) -> str:
        return f"{self.rendition} · verse {self.verse_id} @ {self.start_ms}ms"
