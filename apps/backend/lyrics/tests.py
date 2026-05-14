from django.test import TestCase
from rest_framework.test import APIClient

from accounts.models import User
from catalog.models import Collection, Track
from common.models import EditorialState
from lyrics.models import LyricDirection, LyricLanguage, LyricLanguageRole, LyricSegment, LyricSet, UserLyricPreference


class LyricApiTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="editor", password="test", is_staff=True)
        self.collection = Collection.objects.create(title="Collection", slug="lyric-collection", visibility=EditorialState.PUBLIC)
        self.track = Track.objects.create(title="Lyric Track", slug="lyric-track", collection=self.collection, visibility=EditorialState.PUBLIC)
        self.lyric_set = LyricSet.objects.create(track=self.track, title="Canonical", source="canonical", is_canonical=True)
        self.urdu = LyricLanguage.objects.create(
            lyric_set=self.lyric_set,
            code="ur",
            name="Urdu",
            role=LyricLanguageRole.ORIGINAL,
            direction=LyricDirection.RTL,
            is_published=True,
        )
        self.english = LyricLanguage.objects.create(
            lyric_set=self.lyric_set,
            code="en",
            name="English",
            role=LyricLanguageRole.TRANSLATION,
            direction=LyricDirection.LTR,
            display_order=1,
            is_published=True,
        )
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def test_replace_segments_and_playback_manifest_include_direction_metadata(self):
        response = self.client.put(
            f"/api/lyrics/sets/{self.lyric_set.id}/segments/",
            {
                "segments": [
                    {
                        "start_ms": 0,
                        "end_ms": 3000,
                        "text_by_language": {str(self.urdu.id): "درود", str(self.english.id): "Blessing"},
                    }
                ]
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        playback = self.client.get(f"/api/catalog/tracks/{self.track.id}/playback/")
        self.assertEqual(playback.status_code, 200)
        self.assertEqual(playback.data["lyric_set"]["languages"][0]["direction"], "rtl")
        self.assertEqual(playback.data["lyric_set"]["segments"][0]["text_by_language"][str(self.urdu.id)], "درود")

    def test_webvtt_import_and_export(self):
        response = self.client.post(
            f"/api/lyrics/sets/{self.lyric_set.id}/import/",
            {
                "language_id": self.english.id,
                "format": "webvtt",
                "content": "WEBVTT\n\n00:00:00.000 --> 00:00:02.500\nFirst line\n\n00:00:02.500 --> 00:00:05.000\nSecond line",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(LyricSegment.objects.filter(lyric_set=self.lyric_set).count(), 2)
        export = self.client.get(f"/api/lyrics/sets/{self.lyric_set.id}/export/webvtt/")
        self.assertEqual(export.status_code, 200)
        self.assertIn("WEBVTT", export.content.decode())
        self.assertIn("First line", export.content.decode())

    def test_lrc_import_sets_end_time_from_next_line(self):
        response = self.client.post(
            f"/api/lyrics/sets/{self.lyric_set.id}/import/",
            {
                "language_id": self.english.id,
                "format": "lrc",
                "content": "[00:01.00]First\n[00:03.00]Second",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        first = LyricSegment.objects.filter(lyric_set=self.lyric_set).order_by("start_ms").first()
        self.assertEqual(first.start_ms, 1000)
        self.assertEqual(first.end_ms, 3000)

    def test_invalid_segment_timing_is_rejected(self):
        response = self.client.put(
            f"/api/lyrics/sets/{self.lyric_set.id}/segments/",
            {"segments": [{"start_ms": 3000, "end_ms": 1000, "text_by_language": {str(self.english.id): "Bad"}}]},
            format="json",
        )

        self.assertEqual(response.status_code, 400)

    def test_saved_language_preference_upserts_per_user_track(self):
        response = self.client.put(
            f"/api/me/lyric-preferences/{self.track.id}/",
            {"visible_language_ids": [self.urdu.id, self.english.id]},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(UserLyricPreference.objects.get(user=self.user, track=self.track).visible_language_ids, [self.urdu.id, self.english.id])
        get_response = self.client.get(f"/api/me/lyric-preferences/{self.track.id}/")
        self.assertEqual(get_response.status_code, 200)
        self.assertEqual(get_response.data["visible_language_ids"], [self.urdu.id, self.english.id])
