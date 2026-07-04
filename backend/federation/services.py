"""Mirror resolution: the *automatic* layer of media-host selection.

Given a media asset + storage key, return the ordered list of mirror URLs that
actually carry the file, preferred (lowest priority value) first. The client
applies the *manual* layer on top (user-toggled/disabled mirrors, custom adds).
"""
from __future__ import annotations

from .models import MediaAssetMirror, MediaMirror


def resolve_mirror_urls(storage_key: str, asset=None) -> list[dict]:
    if not storage_key:
        return []

    mirrors = list(MediaMirror.objects.filter(is_active=True).order_by("priority", "name"))

    overrides: dict[int, MediaAssetMirror] = {}
    available_ids: set[int] = set()
    if asset is not None:
        for am in MediaAssetMirror.objects.filter(asset=asset).select_related("mirror"):
            if am.available:
                available_ids.add(am.mirror_id)
            if am.url_override:
                overrides[am.mirror_id] = am

    out: list[dict] = []
    for m in mirrors:
        if m.carries_all:
            ok = True
        elif asset is not None:
            ok = m.id in available_ids
        else:
            ok = False
        if not ok:
            continue
        override = overrides.get(m.id)
        url = override.url_override if (override and override.url_override) else m.url_for(storage_key)
        out.append({
            "mirror": m.slug,
            "name": m.name,
            "kind": m.kind,
            "url": url,
            "default_enabled": m.is_default_enabled,
            "priority": m.priority,
        })
    return out
