"""Aggregated API router for v1 public + app endpoints."""
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from accounts.views import (
    LoginView,
    LogoutView,
    MeView,
    PreferencesView,
    RegisterView,
)
from catalog.me_views import LibraryViewSet, QueueViewSet
from community.admin_views import AdminSubmissionViewSet
from community.views import KalamRequestViewSet, SubmissionViewSet
from content.views import AnnotationViewSet, PublishedFileViewSet
from video_generation.views import VideoGenerationJobViewSet
from catalog.views import (
    CollectionViewSet,
    KalamViewSet,
    PersonViewSet,
    RenditionViewSet,
    SearchView,
)
from federation.views import MirrorDirectoryViewSet, SourceDirectoryViewSet
from media.views import MediaAssetViewSet, UploadSessionView

router = DefaultRouter()
router.register("kalams", KalamViewSet, basename="kalam")
router.register("renditions", RenditionViewSet, basename="rendition")
router.register("people", PersonViewSet, basename="person")
router.register("collections", CollectionViewSet, basename="collection")
# Federation: official directory of content sources ("databases") and media mirrors
router.register("directory/sources", SourceDirectoryViewSet, basename="source")
router.register("directory/mirrors", MirrorDirectoryViewSet, basename="mirror")
# Media pipeline (upload/transcode); list/detail are editor-gated
router.register("media/assets", MediaAssetViewSet, basename="media-asset")
# User-facing, owner-scoped
router.register("me/library", LibraryViewSet, basename="library")
router.register("me/queues", QueueViewSet, basename="queue")
# Community: contributor submissions (all Studio micro-tasks) + requests
router.register("submissions", SubmissionViewSet, basename="submission")
router.register("community/requests", KalamRequestViewSet, basename="community-request")
# Admin review (editor+): list/inspect/approve/apply submissions to canoni