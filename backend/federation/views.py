from __future__ import annotations

from rest_framework import viewsets

from .models import ContentSource, MediaMirror
from .serializers import ContentSourceSerializer, MediaMirrorSerializer


class SourceDirectoryViewSet(viewsets.ReadOnlyModelViewSet):
    """Official directory of content sources ('databases')."""

    lookup_field = "slug"
    serializer_class = ContentSourceSerializer

    def get_queryset(self):
        return ContentSource.objects.filter(is_official=True, is_enabled=True)


class MirrorDirectoryViewSet(viewsets.ReadOnlyModelViewSet):
    """Official directory of media mirrors."""

    lookup_field = "slug"
    serializer_class = MediaMirrorSerializer

    def get_queryset(self):
        return MediaMirror.objects.filter(is_official=True, is_active=True)
