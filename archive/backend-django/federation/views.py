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
    """Directory of media mirrors for the picker — all active mirrors (local +
    official + community). `is_official`/`verified` drive the trust badges."""

    lookup_field = "slug"
    serializer_class = MediaMirrorSer