from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from accounts.models import User
from catalog.models import Collection, Track
from common.models import EditorialState
from media.models import MediaAsset, MediaDerivative, MediaKind, MediaProcessingJob, MediaRendition, ProcessingStatus, UploadSessionStatus


@override_settings(CELERY_TASK_ALWAYS_EAGER=True, CELERY_TASK_EAGER_PROPAGATES=True)
class MediaPipelineTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="editor", password="test", is_staff=True)
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def test_upload_session_completion_processes_audio_asset(self):
        response = self.client.post(
            "/api/media/upload-sessions/",
            {
                "title": "Source audio",
                "original_filename": "source.mp3",
                "mime_type": "audio/mpeg",
                "size_bytes": 1024,
                "checksum_sha256": "a" * 64,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        session_id = response.data["id"]
        asset_id = response.data["asset"]["id"]
        self.assertIn("/originals/audio/", response.data["upload_url"])

        complete_response = self.client.post(f"/api/media/upload-sessions/{session_id}/complete/", {}, format="json")

        self.assertEqual(complete_response.status_code, 200)
        asset = MediaAsset.objects.get(id=asset_id)
        session = asset.upload_session
        self.assertEqual(session.status, UploadSessionStatus.UPLOADED)
        self.assertEqual(asset.status, ProcessingStatus.READY)
        self.assertTrue(MediaRendition.objects.filter(asset=asset, format="mp3", status=ProcessingStatus.READY).exists())
        self.assertTrue(MediaDerivative.objects.filter(asset=asset, kind=MediaDerivative.DerivativeKind.WAVEFORM).exists())
        self.assertTrue(MediaProcessingJob.objects.filter(asset=asset, status=ProcessingStatus.READY).exists())

    def test_playback_manifest_uses_ready_rendition_and_lyrics_shell(self):
        collection = Collection.objects.create(title="Collection", slug="collection", visibility=EditorialState.PUBLIC)
        asset = MediaAsset.objects.create(
            title="Ready audio",
            kind=MediaKind.AUDIO,
            storage_key="originals/audio/ready.mp3",
            mime_type="audio/mpeg",
            size_bytes=100,
            status=ProcessingStatus.READY,
        )
        MediaRendition.objects.create(asset=asset, format="mp3", codec="mp3", storage_key="renditions/audio/ready.mp3", status=ProcessingStatus.READY)
        track = Track.objects.create(title="Ready Track", slug="ready-track", collection=collection, visibility=EditorialState.PUBLIC)
        track.media_assets.add(asset)

        response = self.client.get(f"/api/catalog/tracks/{track.id}/playback/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["id"], track.id)
        self.assertEqual(response.data["preferred_asset"]["id"], asset.id)
        self.assertEqual(response.data["renditions"][0]["format"], "mp3")
        self.assertIn("/renditions/audio/ready.mp3", response.data["renditions"][0]["playback_url"])
