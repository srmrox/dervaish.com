from rest_framework import permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.viewsets import ReadOnlyModelViewSet

from common.models import EditorialState

from .models import Collection, Person, Track
from .serializers import CollectionDetailSerializer, CollectionSummarySerializer, PersonDetailSerializer, PersonSummarySerializer, PlaybackManifestSerializer, TrackDetailSerializer, TrackSummarySerializer


class PublicEditorialQuerySetMixin:
    public_only = True

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user
        if self.public_only and not (user.is_authenticated and user.is_staff):
            queryset = queryset.filter(visibility=EditorialState.PUBLIC)
        return queryset


class CollectionViewSet(PublicEditorialQuerySetMixin, ReadOnlyModelViewSet):
    queryset = Collection.objects.prefetch_related("tracks__credits__person", "archive_records").order_by("title")
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    lookup_field = "slug"

    def get_serializer_class(self):
        if self.action == "retrieve":
            return CollectionDetailSerializer
        return CollectionSummarySerializer


class PersonViewSet(PublicEditorialQuerySetMixin, ReadOnlyModelViewSet):
    queryset = Person.objects.prefetch_related("track_credits__track", "archive_records").order_by("name")
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    lookup_field = "slug"

    def get_serializer_class(self):
        if self.action == "retrieve":
            return PersonDetailSerializer
        return PersonSummarySerializer


class TrackViewSet(PublicEditorialQuerySetMixin, ReadOnlyModelViewSet):
    queryset = Track.objects.prefetch_related(
        "credits__person",
        "collection",
        "media_assets__renditions",
        "media_assets__derivatives",
        "archive_records",
        "captions",
        "chapters",
        "lyric_sets__languages",
        "lyric_sets__segments",
    ).order_by("title")
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_serializer_class(self):
        if self.action == "playback":
            return PlaybackManifestSerializer
        if self.action == "retrieve":
            return TrackDetailSerializer
        return TrackSummarySerializer

    @action(detail=True, methods=["get"], url_path="playback")
    def playback(self, request, pk=None):
        return Response(PlaybackManifestSerializer(self.get_object(), context={"request": request}).data)
