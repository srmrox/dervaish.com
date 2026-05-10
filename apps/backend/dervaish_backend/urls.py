"""URL configuration for the Dervaish backend."""

from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from archive.views import ArchiveRecordViewSet, CitationViewSet, ProvenanceRecordViewSet, VocabularyTermViewSet
from catalog.views import CollectionViewSet, PersonViewSet, TrackViewSet
from media.views import MediaAssetViewSet, MediaProcessingJobViewSet, UploadSessionViewSet

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


def health(_request):
    return JsonResponse({"ok": True, "service": "dervaish-backend"})


urlpatterns = [
    path("admin/", admin.site.urls),
    path("health/", health, name="health"),
    path("api/", include(router.urls)),
]
