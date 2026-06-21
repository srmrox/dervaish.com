"""Seed a minimal but complete public example so the API returns real data.

Idempotent: safe to run repeatedly. Run with `python manage.py seed_demo`.
"""
from __future__ import annotations

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from archive.models import ArchiveRecord, Citation
from catalog.models import (
    Collection,
    CollectionItem,
    Credit,
    Kalam,
    Person,
    PersonRole,
    Rendition,
    Verse,
)
from common.models import EditorialState, Visibility
from lyrics.models import RenditionVerseTiming
from media.models import MediaAsset, MediaKind, MediaRendition, ProcessingStatus
from taxonomy.models import TermKind, VocabularyTerm

PUBLIC = {"visibility": Visibility.PUBLIC, "state": EditorialState.PUBLISHED}


class Command(BaseCommand):
    help = "Seed a minimal public example (kalam, verses, rendition, media, archive)."

    @transaction.atomic
    def handle(self, *args, **options):
        def term(kind, code, label, native=""):
            obj, _ = VocabularyTerm.objects.get_or_create(
                kind=kind, code=code, defaults={"label": label, "label_native": native}
            )
            return obj

        lang_fa = term(TermKind.LANGUAGE, "fa", "Persian", "فارسی")
        genre_naat = term(TermKind.GENRE, "naat", "Naat")
        tradition = term(TermKind.TRADITION, "chishti", "Chishti")
        theme = term(TermKind.THEME, "love-of-prophet", "Love of the Prophet ﷺ")

        author, _ = Person.objects.get_or_create(
            slug="saadi-shirazi",
            defaults={
                "name": "Saadi Shirazi",
                "name_native": "سعدی شیرازی",
                "era": "13th century",
                "region": "Shiraz",
                "tradition": tradition,
                "biography": "Classical Persian poet, widely recited in devotional gatherings.",
                **PUBLIC,
            },
        )
        reciter, _ = Person.objects.get_or_create(
            slug="demo-reciter",
            defaults={"name": "Demo Reciter", "era": "Contemporary", **PUBLIC},
        )

        kalam, _ = Kalam.objects.get_or_create(
            slug="tanam-farsooda-ja-para",
            defaults={
                "title": "Tanam Farsooda Jaan Para",
                "title_native": "تنم فرسودہ جاں پارہ",
                "title_transliterated": "Tanam Farsooda Jaan Para",
                "author": author,
                "primary_language": lang_fa,
                "genre": genre_naat,
                "tradition": tradition,
                "era": "Classical",
                "summary": "A celebrated Persian naat expressing longing for the Prophet ﷺ.",
                "published_at": timezone.now(),
                **PUBLIC,
            },
        )
        kalam.themes.add(theme)

        verses = [
            ("تنم فرسودہ جاں پارہ", "Tanam farsooda jaan para",
             {"en": "My body is worn, my soul in pieces"}),
            ("ز ہجراں یا رسول اللہ", "Ze hijran ya Rasool-Allah",
             {"en": "from separation, O Messenger of Allah ﷺ"}),
        ]
        for i, (native, translit, tr) in enumerate(verses):
            Verse.objects.get_or_create(
                kalam=kalam, order=i,
                defaults={"text_native": native, "transliteration": translit, "translations": tr},
            )

        Credit.objects.get_or_create(kalam=kalam, person=author, role=PersonRole.AUTHOR)

        asset, _ = MediaAsset.objects.get_or_create(
            storage_key="seed/tanam-farsooda/audio-original",
            defaults={
                "kind": MediaKind.AUDIO,
                "mime_type": "audio/mpeg",
                "duration_ms": 215000,
                "processing_status": ProcessingStatus.READY,
                "source_name": "seed",
            },
        )
        MediaRendition.objects.get_or_create(
            asset=asset, container="opus",
            defaults={"bitrate_kbps": 128, "url": "https://cdn.example/seed/tanam.opus",
                      "is_streaming": True, "is_offline_download": True},
        )

        rendition, _ = Rendition.objects.get_or_create(
            slug="tanam-farsooda-demo-rendition",
            defaults={
                "kalam": kalam, "title": "Tanam Farsooda — Demo Rendition",
                "duration_ms": 215000, "year": 2024, "published_at": timezone.now(),
                **PUBLIC,
            },
        )
        rendition.media_assets.add(asset)
        Credit.objects.get_or_create(rendition=rendition, person=reciter, role=PersonRole.RECITER)

        for v in kalam.verses.all():
            RenditionVerseTiming.objects.get_or_create(
                rendition=rendition, verse=v,
                defaults={"start_ms": v.order * 8000, "end_ms": (v.order + 1) * 8000},
            )

        coll, _ = Collection.objects.get_or_create(
            slug="featured-naat",
            defaults={"title": "Featured Naat", "is_curated": True,
                      "description": "A starter curated collection.", **PUBLIC},
        )
        CollectionItem.objects.get_or_create(collection=coll, rendition=rendition, defaults={"position": 0})

        citation, _ = Citation.objects.get_or_create(
            title="Diwan-e-Saadi", source_type=Citation.SourceType.BOOK,
            defaults={"author": "Saadi Shirazi"},
        )
        record, _ = ArchiveRecord.objects.get_or_create(
            slug="tanam-farsooda-record",
            defaults={"title": "Tanam Farsooda — source record",
                      "summary": "Attribution and source notes.",
                      "kalam": kalam, **PUBLIC},
        )
        record.citations.add(citation)

        self.stdout.write(self.style.SUCCESS("Seeded demo kalam, rendition, media, and archive record."))
