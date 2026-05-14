from django.test import TestCase
from rest_framework.test import APIClient

from accounts.models import RoleKind, User
from archive.models import ArchiveRecord
from catalog.models import Collection, Person, Track
from imports.models import ImportBatch, ImportBatchStatus
from media.models import MediaAsset


class ImportBatchApiTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user(username="admin", password="test", role=RoleKind.ADMIN, is_staff=True)
        self.client = APIClient()
        self.client.force_authenticate(self.admin)

    def test_dervaish_dry_run_records_preview_summary(self):
        response = self.client.post(
            "/api/imports/batches/",
            {
                "source": "dervaish_prototype",
                "dry_run": True,
                "source_label": "Prototype export",
                "payload": {"items": [{"type": "track"}, {"type": "item", "metadata": {"source": "demo"}}]},
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        batch = ImportBatch.objects.get(id=response.data["id"])
        self.assertEqual(batch.status, ImportBatchStatus.DRY_RUN)
        self.assertEqual(batch.summary["item_count"], 2)

    def test_dervaish_import_creates_pending_review_catalog_records(self):
        response = self.client.post(
            "/api/imports/batches/",
            {
                "source": "dervaish_prototype",
                "dry_run": False,
                "payload": {
                    "people": [{"name": "Imported Reciter", "slug": "imported-reciter", "primary_role": "reciter"}],
                    "collections": [{"title": "Imported Collection", "slug": "imported-collection", "is_curated": True}],
                    "tracks": [{"title": "Imported Track", "slug": "imported-track", "collection_slug": "imported-collection", "duration_ms": 12000}],
                },
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertTrue(Person.objects.filter(slug="imported-reciter").exists())
        self.assertTrue(Collection.objects.filter(slug="imported-collection").exists())
        self.assertTrue(Track.objects.filter(slug="imported-track").exists())
        self.assertEqual(response.data["summary"]["tracks"], 1)

    def test_mediacms_and_omeka_importers_create_reference_records(self):
        mediacms = self.client.post(
            "/api/imports/batches/",
            {
                "source": "mediacms",
                "dry_run": False,
                "payload": {"media": [{"title": "MediaCMS Video", "url": "https://example.com/video.mp4", "kind": "video"}]},
            },
            format="json",
        )
        omeka = self.client.post(
            "/api/imports/batches/",
            {
                "source": "omeka_s",
                "dry_run": False,
                "payload": {"items": [{"id": 44, "slug": "omeka-item", "title": "Omeka Item", "url": "https://example.com/item/44"}]},
            },
            format="json",
        )

        self.assertEqual(mediacms.status_code, 201)
        self.assertEqual(omeka.status_code, 201)
        self.assertTrue(MediaAsset.objects.filter(source_url="https://example.com/video.mp4").exists())
        self.assertTrue(ArchiveRecord.objects.filter(slug="omeka-item").exists())
