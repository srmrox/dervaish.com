"""Apply an approved Submission's payload to canonical models.

A submission's `payload` carries a `kind` and the proposed data (see the Studio
micro-tasks). On approval an editor calls `apply_submission`, which writes the
canonical Verse / RenditionVerseTiming / translation rows. `source` and `context`
are not auto-applied yet (handled manually / by the content publisher — Phase 5)."""
from __future__ import annotations

from django.db import transaction

from catalog.models import Kalam, Rendition, Verse
from lyrics.models import RenditionVerseTiming


def apply_submission(submission) -> dict:
    payload = submission.payload or {}
    kind = payload.get("kind")
    handler = {
        "transcription": _apply_transcription,
        "timing": _apply_timing,
        "translation": _apply_translation,
    }.get(kind)
    if not handler:
        return {"applied": False, "reason": f"kind '{kind}' is reviewed manually"}
    with transaction.atomic():
        return handler(payload)


def _apply_transcription(p: dict) -> dict:
    kalam = Kalam.objects.get(slug=p["kalam"])
    n = 0
    for v in p.get("verses", []):
        Verse.objects.update_or_create(
            kalam=kalam,
            order=int(v["order"]),
            defaults={
                "text_native": v.get("text_native", ""),
                "transliteration": v.get("transliteration", ""),
            },
        )
        n += 1
    return {"applied": True, "kind": "transcription", "verses": n}


def _apply_timing(p: dict) -> dict:
    rendition = Rendition.objects.get(slug=p["rendition"])
    n = 0
    for t in p.get("timings", []):
        try:
            verse = Verse.objects.get(kalam=rendition.kalam, order=int(t["order"]))
        except Verse.DoesNotExist:
            continue
        RenditionVerseTiming.objects.update_or_create(
            rendition=rendition,
            verse=verse,
            defaults={"start_ms": int(t.get("start_ms", 0)), "end_ms": t.get("end_ms")},
        )
        n += 1
    return {"applied": True, "kind": "timing", "timings": n}


def _apply_translation(p: dict) -> dict:
    kalam = Kalam.objects.get(slug=p["kalam"])
    lang = p.get("language", "en")
    n = 0
    for order, text in (p.get("translations") or {}).items():
        try:
            verse = Verse.objects.get(kalam=kalam, order=int(order))
        except Verse.DoesNotExist:
            continue
        translations = dict(verse.translations or {})
        translations[lang] = text
        verse.translations = translations
        verse.save(update_fields=["translations"])
        n += 1
    return {"applied": True, "kind": "translation", "language": lang, "translations": n}
