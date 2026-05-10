from django.test import TestCase
from rest_framework.test import APIClient

from archive.models import ArchiveRecord, Citation, ProvenanceRecord, SourceRating, VocabularyTerm
from catalog.models import Collection, Person, PersonRole, Track, TrackCredit
from common.models import EditorialState
from media.models import MediaAsset, MediaKind, ProcessingStatus


class PublicArchiveApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.reciter = Person.objects.create(
            name="Public Reciter",
            slug="public-reciter",
            primary_role=PersonRole.RECITER,
            visibility=EditorialState.PUBLIC,
        )
        self.collection = Collection.objects.create(title="Public Collection", slug="public-collection", visibility=EditorialState.PUBLIC)
        self.track = Track.objects.create(
            title="Public Track",
            slug="public-track",
            collection=self.collection,
            visibility=EditorialState.PUBLIC,
            duration_ms=42000,
        )
        TrackCredit.objects.create(track=self.track, person=self.reciter, role=PersonRole.RECITER)
        self.asset = MediaAsset.objects.create(
            title="Source audio",
            kind=MediaKind.AUDIO,
            storage_key="originals/audio/source.mp3",
            status=ProcessingStatus.READY,
        )
        self.track.media_assets.add(self.asset)
        self.citation = Citation.objects.create(
            title="Field Recording Note",
            source_type="field_recording",
            author="Archivist",
            published_at="2026",
            url="https://example.com/source",
            note="Source note.",
        )
        self.term = VocabularyTerm.objects.create(vocabulary="genre", code="naat", label="Naat")
        self.record = ArchiveRecord.objects.create(
            title="Public Archive Record",
            slug="public-archive-record",
            summary="Public archive context.",
            visibility=EditorialState.PUBLIC,
        )
        self.record.tracks.add(self.track)
        self.record.people.add(self.reciter)
        self.record.collections.add(self.collection)
        self.record.citations.add(self.citation)
        self.record.terms.add(self.term)
        ProvenanceRecord.objects.create(
            archive_record=self.record,
            media_asset=self.asset,
            event_type="seeded",
            source_name="Local fixture",
            source_url="https://example.com/source",
            checksum_sha256="abc123",
        )
        SourceRating.objects.create(archive_record=self.record, kind="editorial", value=4, max_value=5, rationale="Strong source.")
        ArchiveRecord.objects.create(
            title="Draft Archive Record",
            slug="draft-archive-record",
            summary="Hidden draft.",
            visibility=EditorialState.DRAFT,
        )

    def test_public_archive_list_excludes_drafts(self):
        response = self.client.get("/api/archive/records/")

        self.assertEqual(response.status_code, 200)
        titles = [item["title"] for item in response.data["results"]]
        self.assertEqual(titles, ["Public Archive Record"])

    def test_archive_detail_includes_citations_provenance_ratings_and_links(self):
        response = self.client.get("/api/archive/records/public-archive-record/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["title"], "Public Archive Record")
        self.assertEqual(response.data["tracks"][0]["title"], "Public Track")
        self.assertEqual(response.data["people"][0]["name"], "Public Reciter")
        self.assertEqual(response.data["collections"][0]["title"], "Public Collection")
        self.assertEqual(response.data["citations"][0]["title"], "Field Recording Note")
        self.assertEqual(response.data["provenance_records"][0]["event_type"], "seeded")
        self.assertEqual(response.data["source_ratings"][0]["value"], 4)

    def test_archive_jsonld_export_includes_linked_public_context(self):
        response = self.client.get("/api/archive/records/public-archive-record/jsonld/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["@type"], "ArchiveRecord")
        self.assertEqual(response.data["title"], "Public Archive Record")
        self.assertEqual(response.data["about"][0]["title"], "Public Track")
        self.assertEqual(response.data["creator"][0]["name"], "Public Reciter")
        self.assertEqual(response.data["citation"][0]["name"], "Field Recording Note")
        self.assertEqual(response.data["provenance"][0]["eventType"], "seeded")
        self.assertEqual(response.data["keywords"], ["Naat"])

    def test_public_catalog_endpoints_expose_linked_records(self):
        collection = self.client.get("/api/catalog/collections/public-collection/")
        person = self.client.get("/api/catalog/people/public-reciter/")
        track = self.client.get(f"/api/catalog/tracks/{self.track.id}/")

        self.assertEqual(collection.status_code, 200)
        self.assertEqual(collection.data["tracks"][0]["title"], "Public Track")
        self.assertEqual(person.status_code, 200)
        self.assertEqual(person.data["tracks"][0]["title"], "Public Track")
        self.assertEqual(track.status_code, 200)
        self.assertEqual(track.data["archive_records"][0]["title"], "Public Archive Record")
