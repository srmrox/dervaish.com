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

extra_urls = [
    path("auth/register/", RegisterView.as_view(), name="register"),
    path("auth/login/", LoginView.as_view(), name="login"),
    path("auth/logout/", LogoutView.as_view(), name="logout"),
    path("me/", MeView.as_view(), name="me"),
    path("me/preferences/", PreferencesView.as_view(), name="me-preferences"),
    path("search/", SearchView.as_view(), name="search"),
    path("media/upload-sessions/", UploadSessionView.as_view(), name="upload-session"),
]

urlpatterns = [
    path("v1/", include((extra_urls + router.urls, "v1"))),
]
