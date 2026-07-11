"""Build the render payload consumed by the local 5090 worker (the Lyrics Video
MoviePy/NVENC renderer). Segments come from RenditionVerseTiming + Verse text."""
from __future__ import annotations

from lyrics.models import RenditionVerseTiming


def build_render_payload(job) -> dict:
    rendition = job.rendition
    segments = []
    if rendition:
        timings = (
            RenditionVerseTiming.objects.filter(rendition=rendition)
            .select_related("verse")
            .order_by("start_ms")
        )
        for t in timings:
            v = t.verse
            segments.append(
                {
                    "order": v.order,
                    "startMs": t.start_ms,
                    "endMs": t.end_ms,
                    "textNative": v.text_native,
                    "transliteration": v.transliteration,
                    "translations": v.translations,
                }
            )
    return {
        "jobId": job.id,
        "rendition": rendition.slug if rendition else None,
        "sourceMode": job.source_mode,
        "layoutId": job.layout_id,
        "resolution": job.resolution,
        "visibleLanguages": job.visible_language_codes,
        "title": job.title,
        "segments": segments,
    }
