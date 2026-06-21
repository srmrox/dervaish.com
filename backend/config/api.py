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

router = DefaultRouter()
router.register("kalams", KalamViewSet, basename="kalam")
router.register("renditions", RenditionViewSet, basename="rendition")
router.register("people", PersonViewSet, basename="person")
router.register("collections", CollectionViewSet, basename="collection")
# Federation: official directory of content sources ("databases") and media mirrors
router.register("directory/sources", SourceDirectoryViewSet, basename="source")
router.register("directory/mirrors", MirrorDirectoryViewSet, basename="mirror")
# User-facing, owner-scoped
router.register("me/library", LibraryViewSet, basename="library")
router.register("me/queues", QueueViewSet, basename="queue")

auth_urls = [
    path("auth/register/", RegisterView.as_view(), name="register"),
    path("auth/login/", LoginView.as_view(), name="login"),
    path("auth/logout/", LogoutView.as_view(), name="logout"),
    path("me/", MeView.as_view(), name="me"),
    path("me/preferences/", PreferencesView.as_view(), name="me-preferences"),
    path("search/", SearchView.as_view(), name="search"),
]

urlpatterns = [
    path("v1/", include((auth_urls + router.urls, "v1"))),
]
