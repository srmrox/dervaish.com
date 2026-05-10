from django.test import TestCase

from archive.models import ArchiveRecord, Citation, ProvenanceRecord
from catalog.models import Collection, Person, PersonRole, Track, TrackCredit
from common.models import EditorialState
from lyrics.models import LyricDirection, LyricLanguage, LyricLanguageRole, LyricSegment, LyricSet
from media.models import MediaAsset, MediaKind, MediaRendition, ProcessingStatus


class CanonicalModelSmokeTests(TestCase):
    def test_minimal_public_track_can_link_media_lyrics_archive_and_credits(self):
        reciter = Person.objects.create(name="Sample Reciter", slug="sample-reciter", primary_role=PersonRole.RECITER)
        writer = Person.objects.create(name="Sample Writer", slug="sample-writer", primary_role=PersonRole.WRITER)
        collection = Collection.objects.create(title="Founding Collection", slug="founding-collection", visibility=EditorialState.PUBLIC)
        asset = MediaAsset.objects.create(
            title="Sample audio",
            kind=MediaKind.AUDIO,
            storage_key="originals/sample.mp3",
            mime_type="audio/mpeg",
            status=ProcessingStatus.READY,
        )
        rendition = MediaRendition.objects.create(
            asset=asset,
            format="mp3",
            codec="mp3",
            storage_key="renditions/sample.mp3",
            status=ProcessingStatus.READY,
        )
        track = Track.objects.create(
            title="Sample Track",
            slug="sample-track",
            collection=collection,
            visibility=EditorialState.PUBLIC,
            duration_ms=120000,
        )
        track.media_assets.add(asset)
        TrackCredit.objects.create(track=track, person=reciter, role=PersonRole.RECITER)
        TrackCredit.objects.create(track=track, person=writer, role=PersonRole.WRITER)

        lyric_set = LyricSet.objects.create(track=track, title="Canonical lyrics", is_canonical=True)
        urdu = LyricLanguage.objects.create(
            lyric_set=lyric_set,
            code="ur",
            name="Urdu",
            role=LyricLanguageRole.ORIGINAL,
            direction=LyricDirection.RTL,
            is_published=True,
        )
        english = LyricLanguage.objects.create(
            lyric_set=lyric_set,
            code="en",
            name="English",
            role=LyricLanguageRole.TRANSLATION,
            direction=LyricDirection.LTR,
            display_order=1,
            is_published=True,
        )
        LyricSegment.objects.create(
            lyric_set=lyric_set,
            start_ms=0,
            end_ms=5000,
            text_by_language={str(urdu.id): "نمونہ", str(english.id): "Sample"},
        )
        citation = Citation.objects.create(title="Field note", source_type="field_recording", note="Minimal seed source.")
        record = ArchiveRecord.objects.create(
            title="Sample Archive Record",
            slug="sample-archive-record",
            summary="A minimal archival context record.",
            visibility=EditorialState.PUBLIC,
        )
        record.tracks.add(track)
        record.people.add(reciter, writer)
        record.citations.add(citation)
        ProvenanceRecord.objects.create(archive_record=record, media_asset=asset, event_type="seeded", checksum_sha256="abc123")

        self.assertEqual(track.credits.count(), 2)
        self.assertEqual(track.media_assets.first(), asset)
        self.assertEqual(asset.renditions.first(), rendition)
        self.assertEqual(track.lyric_sets.get(is_canonical=True).languages.count(), 2)
        self.assertEqual(record.tracks.first(), track)
