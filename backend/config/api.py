"""Aggregated API router for v1 public + app endpoints."""
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from catalog.views import (
    CollectionViewSet,
    KalamViewSet,
    PersonViewSet,
    RenditionViewSet,
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

urlpatterns = [
    path("v1/", include((router.urls, "v1"))),
]
