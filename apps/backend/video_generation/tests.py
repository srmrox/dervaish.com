from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from accounts.models import RoleKind, User
from audit.models import AuditLog
from catalog.models import Collection, Track
from common.models import EditorialState
from lyrics.models import LyricDirection, LyricLanguage, LyricLanguageRole, LyricSegment, LyricSet
from media.models import MediaAsset, MediaKind, ProcessingStatus
from video_generation.models import VideoGenerationJob, VideoGenerationStatus


@override_settings(CELERY_TASK_ALWAYS_EAGER=True, CELERY_TASK_EAGER_PROPAGATES=True)
class VideoGenerationWorkflowTests(TestCase):
    def setUp(self):
        self.editor = User.objects.create_user(username="editor", password="test", role=RoleKind.EDITOR, is_staff=True)
        self.collection = Collection.objects.create(title="Video Collection", slug="video-collection", visibility=EditorialState.PUBLIC)
        self.track = Track.objects.create(title="Video Track", slug="video-track", collection=self.collection, visibility=EditorialState.PUBLIC)
        self.source_asset = MediaAsset.objects.create(
            title="Source audio",
            kind=MediaKind.AUDIO,
            storage_key="originals/audio/source.mp3",
            mime_type="audio/mpeg",
            status=ProcessingStatus.READY,
        )
        self.track.media_assets.add(self.source_asset)
        self.lyric_set = LyricSet.objects.create(track=self.track, title="Canonical", is_canonical=True)
        self.language = LyricLanguage.objects.create(
            lyric_set=self.lyric_set,
            code="ur",
            name="Urdu",
            role=LyricLanguageRole.ORIGINAL,
            direction=LyricDirection.RTL,
            is_published=True,
        )
        LyricSegment.objects.create(
            lyric_set=self.lyric_set,
            start_ms=0,
            end_ms=5000,
            text_by_language={str(self.language.id): "درود"},
        )
        self.client = APIClient()
        self.client.force_authenticate(self.editor)

    def test_create_job_builds_payload_renders_assets_and_publish_links_output(self):
        response = self.client.post(
            "/api/video-generation/jobs/",
            {
                "track": self.track.id,
                "source_asset": self.source_asset.id,
                "lyric_set": self.lyric_set.id,
                "source_mode": "audio_visualizer",
                "layout_id": "landscape-1",
                "resolution": "1080p",
                "visible_language_ids": [self.language.id],
                "title": "Generated video",
                "voice": "Sample voice",
                "writer": "Sample writer",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        job = VideoGenerationJob.objects.get(id=response.data["id"])
        self.assertEqual(job.status, VideoGenerationStatus.COMPLETED)
        self.assertEqual(job.render_payload["visibleLanguages"][0]["direction"], "rtl")
        self.assertEqual(job.render_payload["segments"][0]["textByLanguageId"][str(self.language.id)], "درود")
        self.assertIsNotNone(job.preview_asset)
        self.assertIsNotNone(job.output_asset)
        self.assertEqual(job.output_asset.kind, MediaKind.VIDEO)

        publish = self.client.post(f"/api/video-generation/jobs/{job.id}/publish/")

        self.assertEqual(publish.status_code, 200)
        job.refresh_from_db()
        self.assertIsNotNone(job.published_at)
        self.assertTrue(self.track.media_assets.filter(id=job.output_asset_id).exists())
        self.assertTrue(AuditLog.objects.filter(action="video_generation.publish", object_id=str(job.id)).exists())

    def test_cancel_marks_queued_job_cancelled(self):
        job = VideoGenerationJob.objects.create(
            requested_by=self.editor,
            track=self.track,
            source_asset=self.source_asset,
            lyric_set=self.lyric_set,
            source_mode="audio_visualizer",
            title="Queued video",
            status=VideoGenerationStatus.QUEUED,
        )

        response = self.client.post(f"/api/video-generation/jobs/{job.id}/cancel/")

        self.assertEqual(response.status_code, 200)
        job.refresh_from_db()
        self.assertEqual(job.status, VideoGenerationStatus.CANCELLED)
        self.assertIsNotNone(job.cancelled_at)

    def test_publish_rejects_unrendered_job(self):
        job = VideoGenerationJob.objects.create(
            requested_by=self.editor,
            track=self.track,
            source_asset=self.source_asset,
            source_mode="audio_visualizer",
            title="Not rendered",
            status=VideoGenerationStatus.QUEUED,
        )

        response = self.client.post(f"/api/video-generation/jobs/{job.id}/publish/")

        self.assertEqual(response.status_code, 400)
