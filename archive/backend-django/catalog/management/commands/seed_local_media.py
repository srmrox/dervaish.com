"""Turn the bundled sample files into one clean, real rendition for local/offline
use — replacing seed_demo's placeholder renditions.

Registers a `local` MediaMirror (served from MEDIA_ROOT by the range server),
reads metadata from mediafiles/samples/tanam-farsooda/lyrics.json, deletes the
placeholder Tanam renditions, and creates a single public rendition with the
local audio + video attached and a reciter credit. Run after `seed_demo`.

    python manage.py seed_local_media    (set DERVAISH_LOCAL_MODE=true first)
"""
from __future__ import annotations

import json
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand
from django.utils import timezone
from django.utils.text import slugify

from catalog.models import Credit, Kalam, Person, PersonRole, ProtectionLevel, Rendition
from common.models import Visibility
from federation.models import MediaAssetMirror, MediaMirror
from media.models import MediaAsset, MediaKind, MediaRendition, ProcessingStatus

SAMPLE_DIR = "samples/tanam-farsooda"
SAMPLES = [
    ("audio.mp3", MediaKind.AUDIO, "mp3", "audio/mpeg"),
    ("landscape-1080p.mp4", MediaKind.VIDEO, "mp4", "video/mp4"),
    ("portrait-1080p.mp4", MediaKind.VIDEO, "mp4", "video/mp4"),
]


class Command(BaseCommand):
    help = "Register the local mirror + build one real rendition from the bundled sample files."

    def handle(self, *args, **opts):
        media_root = Path(settings.MEDIA_ROOT)

        # 1. metadata
        meta = {}
        meta_path = media_root / SAMPLE_DIR / "lyrics.json"
        if meta_path.exists():
            try:
                meta = json.loads(meta_path.read_text(encoding="utf-8")).get("metadata", {})
            except Exception:
                meta = {}
        title = meta.get("title") or "Tanam Farsooda Jaan Para"
        voice = (meta.get("voice") or "").strip()

        # 2. local mirror
        carries_all = getattr(settings, "DERVAISH_LOCAL_MODE", False)
        mirror, _ = MediaMirror.objects.update_or_create(
            slug="local",
            defaults=dict(
                name="This device (local)",
                base_url=getattr(settings, "LOCAL_MEDIA_BASE_URL", "/media/"),
                kind="local",
                is_official=False,
                is_active=True,
                is_default_enabled=True,
                verified=True,
                carries_all=carries_all,
                priority=0,
            ),
        )

        # 3. media assets from the files on disk
        assets: list[MediaAsset] = []
        for name, kind, container, mime in SAMPLES:
            key = f"{SAMPLE_DIR}/{name}"
            path = media_root / SAMPLE_DIR / name
            if not path.exists():
                self.stdout.write(f"  skip (missing): {key}")
                continue
            asset, _ = MediaAsset.objects.update_or_create(
                storage_key=key,
                defaults=dict(
                    kind=kind, mime_type=mime, original_filename=name,
                    size_bytes=path.stat().st_size, processing_status=ProcessingStatus.READY,
                    source_name="local sample",
                ),
            )
            MediaRendition.objects.update_or_create(
                asset=asset, storage_key=key,
                defaults=dict(container=container, url="", is_streaming=True,
                              is_offline_download=(kind == MediaKind.AUDIO),
                              processing_status=ProcessingStatus.READY),
            )
            MediaAssetMirror.objects.update_or_create(asset=asset, mirror=mirror, defaults=dict(available=True))
            assets.append(asset)

        if not assets:
            self.stderr.write(f"No sample files in {media_root / SAMPLE_DIR}/ — drop them there and re-run.")
            return

        # 4. the kalam (needs seed_demo)
        kalam = (
            Kalam.objects.filter(slug__icontains="tanam").first()
            or Kalam.objects.filter(title__icontains="tanam").first()
        )
        if kalam is None:
            self.stderr.write("No Tanam kalam found — run `seed_demo` first.")
            return

        # 5. replace placeholder renditions with one clean, public rendition
        Rendition.objects.filter(kalam=kalam).delete()
        rendition = Rendition.objects.create(
            kalam=kalam,
            title=title,
            slug="tanam-farsooda-local",
            protection_level=ProtectionLevel.OPEN,
            visibility=Visibility.PUBLIC,
            published_at=timezone.now(),
        )
        for asset in assets:
            rendition.media_assets.add(asset)

        # 6. reciter credit
        if voice:
            person, _ = Person.objects.get_or_create(
                slug=slugify(voice),
                defaults=dict(name=voice, visibility=Visibility.PUBLIC),
            )
            Credit.objects.get_or_create(
                person=person, rendition=rendition, role=PersonRole.RECITER,
                defaults=dict(display_order=0),
            )

        self.stdout.write(
            self.style.SUCCESS(
                f"Rendition '{title}'"
                + (f" by {voice}" if voice else "")
                + f" — {len(assets)} local file(s), served from {mirror.base_url}."
            )
        )
