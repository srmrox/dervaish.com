"""URL configuration for the Dervaish backend."""

from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from archive.views import ArchiveRecordViewSet, CitationViewSet, ProvenanceRecordViewSet, VocabularyTermViewSet
from catalog.views import CollectionViewSet, PersonViewSet, TrackViewSet
from community.views import CorrectionDraftViewSet, SubmissionViewSet, TrackRequestViewSet
from imports.views import ImportBatchViewSet
from lyrics.views import LyricPreferenceViewSet, LyricSetViewSet
from media.views import MediaAssetViewSet, MediaProcessingJobViewSet, UploadSessionViewSet
from public.views import export_archive_records, metrics, readiness, search
from video_generation.views import VideoGenerationJobViewSet

router = DefaultRouter()
router.register("media/upload-sessions", UploadSessionViewSet, basename="upload-session")
router.register("media/assets", MediaAssetViewSet, basename="media-asset")
router.register("media/processing-jobs", MediaProcessingJobViewSet, basename="media-processing-job")
router.register("catalog/collections", CollectionViewSet, basename="collection")
router.register("catalog/people", PersonViewSet, basename="person")
router.register("catalog/tracks", TrackViewSet, basename="track")
router.register("archive/records", ArchiveRecordViewSet, basename="archive-record")
router.register("archive/citations", CitationViewSet, basename="citation")
router.register("archive/vocabularies", VocabularyTermViewSet, basename="vocabulary-term")
router.register("archive/provenance", ProvenanceRecordViewSet, basename="provenance-record")
router.register("lyrics/sets", LyricSetViewSet, basename="lyric-set")
router.register("me/lyric-preferences", LyricPreferenceViewSet, basename="lyric-preference")
router.register("submissions", SubmissionViewSet, basename="submission")
router.register("community/submissions", SubmissionViewSet, basename="community-submission")
router.register("community/corrections", CorrectionDraftViewSet, basename="correction-draft")
router.register("community/track-requests", TrackRequestViewSet, basename="track-request")
router.register("video-generation/jobs", VideoGenerationJobViewSet, basename="video-generation-job")
router.register("imports/batches", ImportBatchViewSet, basename="import-batch")


def health(_request):
    return JsonResponse({"ok": True, "service": "dervaish-backend"})


urlpatterns = [
    path("admin/", admin.site.urls),
    path("health/", health, name="health"),
    path("ready/", readiness, name="readiness"),
    path("metrics/", metrics, name="metrics"),
    path("api/search/", search, name="search"),
    path("api/export/archive-records/", export_archive_records, name="export-archive-records"),
    path("api/", include(router.urls)),
]
