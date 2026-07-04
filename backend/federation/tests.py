from __future__ import annotations

from django.test import TestCase

from catalog.models import Kalam, Rendition
from catalog.serializers import RenditionSerializer
from common.models import EditorialState, Visibility
from federation.github import guess_container, is_github_url, normalize_github_url
from media.models import MediaAsset, MediaKind, ProcessingStatus

PUBLIC = {"visibility": Visibility.PUBLIC, "state": EditorialState.PUBLISHED}


class NormalizeGitHubUrlTests(TestCase):
    def test_blob_url_becomes_raw(self):
        self.assertEqual(
            normalize_github_url("https://github.com/o/r/blob/main/dir/a.mp3"),
            "https://raw.githubusercontent.com/o/r/main/dir/a.mp3",
        )

    def test_raw_path_form_becomes_raw_host(self):
        self.assertEqual(
            normalize_github_url("https://github.com/o/r/raw/main/a.mp4"),
            "https://raw.githubusercontent.com/o/r/main/a.mp4",
        )

    def test_raw_true_query_dropped(self):
        self.assertEqual(
            normalize_github_url("https://github.com/o/r/blob/main/a.mp3?raw=true"),
            "https://raw.githubusercontent.com/o/r/main/a.mp3",
        )

    def test_already_raw_passthrough(self):
        url = "https://raw.githubusercontent.com/o/r/main/a.mp3"
        self.assertEqual(normalize_github_url(url), url)

    def test_non_github_passthrough(self):
        url = "https://cdn.example.com/a.mp3"
        self.assertEqual(normalize_github_url(url), url)

    def test_non_file_github_link_passthrough(self):
        url = "https://github.com/o/r"  # repo root, not a file
        self.assertEqual(normalize_github_url(url), url)

    def test_empty_passthrough(self):
        self.assertEqual(normalize_github_url(""), "")

    def test_is_github_url(self):
        self.assertTrue(is_github_url("https://github.com/o/r/blob/main/a.mp3"))
        self.assertTrue(is_github_url("https://raw.githubusercontent.com/o/r/main/a.mp3"))
        self.assertFalse(is_github_url("https://example.com/a.mp3"))
        self.assertFalse(is_github_url(""))

    def test_guess_container(self):
        self.assertEqual(guess_container("https://x/a.mp3"), "mp3")
        self.assertEqual(guess_container("https://x/a.m4a"), "aac")
        self.assertEqual(guess_container("https://x/a.mp4"), "mp4")
        self.assertEqual(guess_container("https://x/playlist.m3u8"), "hls")
        self.assertEqual(guess_container("https://x/noext"), "bin")


class ManifestSourceUrlTests(TestCase):
    def test_github_source_url_becomes_playable_variant(self):
        kalam = Kalam.objects.create(slug="k", title="K", **PUBLIC)
        rendition = Rendition.objects.create(slug="r", kalam=kalam, **PUBLIC)
        asset = MediaAsset.objects.create(
            kind=MediaKind.AUDIO,
            source_url="https://github.com/o/r/blob/main/a.mp3",
            processing_status=ProcessingStatus.READY,
        )
        rendition.media_assets.add(asset)

        data = RenditionSerializer(rendition).data
        variants = data["playback"]["variants"]
        self.assertEqual(len(variants), 1)
        v = variants[0]
        self.assertTrue(v["source"])
        self.assertEqual(v["container"], "mp3")
        self.assertEqual(v["url"], "https://raw.githubusercontent.com/o/r/main/a.mp3")
        self.assertEqual(v["mirrors"][0]["kind"], "github")
        self.assertTrue(v["mirrors"][0]["default_enabled"])
