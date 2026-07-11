from __future__ import annotations

import tempfile
from unittest import mock

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from rest_framework.test import APITestCase

from media.models import MediaAsset, MediaKind, ProcessingStatus
from media.tasks import process_media_asset

User = get_user_model()

# Patch targets used by the task's IO so no real ffmpeg/storage is needed.
_PROBE = "media.tasks.transcode.ffprobe_metadata"
_FFMPEG = "media.tasks.transcode.run_ffmpeg"
_DL = "media.tasks.storage.download_to_temp"
_UP = "media.tasks.storage.upload_file"


class ProcessMediaAssetTests(APITestCase):
    def _asset(self):
        return MediaAsset.objects.create(
            kind=MediaKind.AUDIO, mime_type="audio/mpeg", storage_key="dev/audio/1/original.mp3",
        )

    def test_success_creates_variants_and_marks_ready(self):
        asset = self._asset()
        with mock.patch(_DL, return_value="/tmp/in.mp3"), \
             mock.patch(_PROBE, return_value={"duration_ms": 215000, "width": None, "height": None}), \
             mock.patch(_FFMPEG), mock.patch(_UP, side_effect=lambda p, k: k):
            result = process_media_asset(asset.id)

        asset.refresh_from_db()
        self.assertEqual(asset.processing_status, ProcessingStatus.READY)
        self.assertEqual(asset.duration_ms, 215000)
        # opus (offline) + aac (compat)
        self.assertEqual(asset.variants.count(), 2)
        self.assertEqual(result["variants"], 2)
        opus = asset.variants.get(container="opus")
        self.assertTrue(opus.is_offline_download)
        self.assertEqual(opus.storage_key, "dev/audio/%d/opus-128.opus" % asset.id)

    def test_failure_is_recorded_not_raised(self):
        asset = self._asset()
        with mock.patch(_DL, return_value="/tmp/in.mp3"), \
             mock.patch(_PROBE, return_value={"duration_ms": 0, "width": None, "height": None}), \
             mock.patch(_FFMPEG, side_effect=RuntimeError("ffmpeg boom")):
            result = process_media_asset(asset.id)

        asset.refresh_from_db()
        self.assertEqual(asset.processing_status, ProcessingStatus.FAILED)
        self.assertIn("boom", asset.processing_error)
        self.assertEqual(result["status"], ProcessingStatus.FAILED)

    def test_missing_storage_key_fails_cleanly(self):
        asset = MediaAsset.objects.create(kind=MediaKind.AUDIO, mime_type="audio/mpeg")
        result = process_media_asset(asset.id)
        asset.refresh_from_db()
        self.assertEqual(asset.processing_status, ProcessingStatus.FAILED)
        self.assertEqual(result["variants"], 0)


@override_settings(MEDIA_ROOT=tempfile.mkdtemp())
class UploadApiTests(APITestCase):
    def setUp(self):
        self.listener = User.objects.create_user(username="l", password="x", role="listener")
        self.contributor = User.objects.create_user(username="c", password="x", role="contributor")
        self.editor = User.objects.create_user(username="e", password="x", role="editor")

    def test_upload_session_requires_contributor(self):
        self.client.force_authenticate(self.listener)
        resp = self.client.post(
            "/api/v1/media/upload-sessions/",
            {"kind": "audio", "mime_type": "audio/mpeg", "original_filename": "a.mp3"},
            format="json",
        )
        self.assertEqual(resp.status_code, 403)

    def test_full_upload_flow(self):
        self.client.force_authenticate(self.contributor)
        session = self.client.post(
            "/api/v1/media/upload-sessions/",
            {"kind": "audio", "mime_type": "audio/mpeg", "original_filename": "a.mp3"},
            format="json",
        )
        self.assertEqual(session.status_code, 201)
        asset_id = session.data["asset_id"]
        self.assertTrue(session.data["storage_key"].endswith(f"/{asset_id}/original.mp3"))

        # server-mediated upload (dev path)
        up = self.client.post(
            session.data["upload_path"],
            {"file": SimpleUploadedFile("a.mp3", b"bytes", content_type="audio/mpeg")},
            format="multipart",
        )
        self.assertEqual(up.status_code, 200)

        # complete enqueues processing (mock so no transcode runs here)
        with mock.patch("media.views.process_media_asset.delay") as delay:
            done = self.client.post(f"/api/v1/media/assets/{asset_id}/complete/")
        self.assertEqual(done.status_code, 202)
        delay.assert_called_once_with(asset_id)

    def test_assets_list_requires_editor(self):
        self.client.force_authenticate(self.contributor)
        self.assertEqual(self.client.get("/api/v1/media/assets/").status_code, 403)
        self.client.force_authenticate(self.editor)
        self.assertEqual(self.client.get("/api/v1/media/assets/").status_code, 200)
