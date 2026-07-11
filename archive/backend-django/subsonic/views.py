"""Minimal OpenSubsonic surface so third-party music clients can stream the
catalogue and read synced multilingual lyrics (plan §14). JSON responses; a
subset of the protocol. Auth is not enforced yet (scaffold)."""
from __future__ import annotations

from django.http import HttpResponseRedirect, JsonResponse

from catalog.models import Rendition
from lyrics.models import RenditionVerseTiming


def _resp(payload: dict | None = None) -> JsonResponse:
    body = {
        "subsonic-response": {
            "status": "ok",
            "version": "1.16.1",
            "type": "dervaish",
            "serverVersion": "0.1",
            "openSubsonic": True,
        }
    }
    if payload:
        body["subsonic-response"].update(payload)
    return JsonResponse(body)


def ping(request):
    return _resp()


def get_license(request):
    return _resp({"license": {"valid": True}})


def get_lyrics_by_song_id(request):
    """OpenSubsonic getLyricsBySongId → structuredLyrics (one entry per language)."""
    slug = request.GET.get("id", "")
    try:
        rendition = Rendition.objects.select_related("kalam__primary_language").get(slug=slug)
    except Rendition.DoesNotExist:
        return _resp({"lyricsList": {"structuredLyrics": []}})

    native_code = "und"
    if rendition.kalam and rendition.kalam.primary_language_id:
        native_code = rendition.kalam.primary_language.code

    lines_by_lang: dict[str, list[dict]] = {}
    timings = (
        RenditionVerseTiming.objects.filter(rendition=rendition)
        .select_related("verse")
        .order_by("start_ms")
    )
    for t in timings:
        v = t.verse
        if v.text_native:
            lines_by_lang.setdefault(native_code, []).append({"start": t.start_ms, "value": v.text_native})
        for code, text in (v.translations or {}).items():
            lines_by_lang.setdefault(code, []).append({"start": t.start_ms, "value": text})

    structured = [
        {"lang": code, "synced": True, "line": lines} for code, lines in lines_by_lang.items()
    ]
    return _resp({"lyricsList": {"structuredLyrics": structured}})


def stream(request):
    """Redirect to the rendition's first playable variant URL."""
    slug = request.GET.get("id", "")
    try:
        rendition = Rendition.objects.prefetch_related("media_assets__variants").get(slug=slug)
    except Rendition.DoesNotExist:
        return _resp()
    for asset in rendition.media_assets.all():
        for variant in asset.variants.all():
            if variant.url:
                return HttpResponseRedirect(variant.url)
    return _resp()
