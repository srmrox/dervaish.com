from django.test import TestCase
from rest_framework.test import APIClient

from accounts.models import RoleKind, User
from archive.models import ArchiveRecord, Citation
from catalog.models import Collection, Person, Track, TrackCredit
from common.models import EditorialState


class PublicPolishApiTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user(username="admin", password="test", role=RoleKind.ADMIN, is_staff=True)
        self.client = APIClient()
        self.person = Person.objects.create(name="Search Reciter", slug="search-reciter", primary_role="reciter", visibility=EditorialState.PUBLIC)
        self.collection = Collection.objects.create(title="Search Collection", slug="search-collection", visibility=EditorialState.PUBLIC)
        self.track = Track.objects.create(title="Search Track", slug="search-track", collection=self.collection, visibility=EditorialState.PUBLIC)
        TrackCredit.objects.create(track=self.track, person=self.person, role="reciter")
        self.citation = Citation.objects.create(title="Search Citation", source_type="website", url="https://example.com", note="Search note")
        self.record = ArchiveRecord.objects.create(title="Search Archive Record", slug="search-archive-record", summary="Searchable summary", visibility=EditorialState.PUBLIC)
        self.record.tracks.add(self.track)
        self.record.people.add(self.person)
        self.record.collections.add(self.collection)
        self.record.citations.add(self.citation)

    def test_search_returns_public_catalog_and_archive_results(self):
        response = self.client.get("/api/search/?q=Search")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["tracks"][0]["title"], "Search Track")
        self.assertEqual(response.data["people"][0]["name"], "Search Reciter")
        self.assertEqual(response.data["collections"][0]["title"], "Search Collection")
        self.assertEqual(response.data["archive_records"][0]["title"], "Search Archive Record")

    def test_archive_export_supports_json_and_csv(self):
        json_response = self.client.get("/api/export/archive-records/?type=json")
        csv_response = self.client.get("/api/export/archive-records/?type=csv")

        self.assertEqual(json_response.status_code, 200)
        self.assertEqual(json_response.data[0]["title"], "Search Archive Record")
        self.assertEqual(csv_response.status_code, 200)
        self.assertIn("Search Archive Record", csv_response.content.decode())

    def test_readiness_and_admin_metrics(self):
        ready = self.client.get("/ready/")
        self.client.force_authenticate(self.admin)
        metrics = self.client.get("/metrics/")

        self.assertEqual(ready.status_code, 200)
        self.assertTrue(ready.json()["ok"])
        self.assertEqual(metrics.status_code, 200)
        self.assertEqual(metrics.data["catalog"]["tracks"], 1)
