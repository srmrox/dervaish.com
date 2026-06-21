from __future__ import annotations

from rest_framework import viewsets

from .models import Collection, Kalam, Person, Rendition
from .serializers import (
    CollectionSerializer,
    KalamDetailSerializer,
    KalamListSerializer,
    PersonDetailSerializer,
    PersonListSerializer,
    RenditionSerializer,
)

PUBLIC = ["public", "unlisted"]


class KalamViewSet(viewsets.ReadOnlyModelViewSet):
    lookup_field = "slug"
    filterset_fields = ["genre", "primary_language", "tradition"]
    search_fields = ["title", "title_native", "title_transliterated", "summary"]
    ordering_fields = ["title", "published_at"]

    def get_queryset(self):
        return (
            Kalam.objects.filter(visibility__in=PUBLIC)
            .select_related("author", "genre", "primary_language", "tradition")
            .prefetch_related("verses", "themes", "renditions", "credits__person")
        )

    def get_serializer_class(self):
        return KalamDetailSerializer if self.action == "retrieve" else KalamListSerializer


class RenditionViewSet(viewsets.ReadOnlyModelViewSet):
    lookup_field = "slug"
    serializer_class = RenditionSerializer
    search_fields = ["title", "album", "publisher"]

    def get_queryset(self):
        return (
            Rendition.objects.filter(visibility__in=PUBLIC)
            .select_related("kalam")
            .prefetch_related("credits__person", "media_assets__variants")
        )


class PersonViewSet(viewsets.ReadOnlyModelViewSet):
    lookup_field = "slug"
    search_fields = ["name", "name_native"]

    def get_queryset(self):
        return Person.objects.filter(visibility__in=PUBLIC).select_related("tradition")

    def get_serializer_class(self):
        return PersonDetailSerializer if self.action == "retrieve" else PersonListSerializer


class CollectionViewSet(viewsets.ReadOnlyModelViewSet):
    lookup_field = "slug"
    serializer_class = CollectionSerializer

    def get_queryset(self):
        return Collection.objects.filter(visibility__in=PUBLIC)
