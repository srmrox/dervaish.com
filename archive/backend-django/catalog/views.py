from __future__ import annotations

from django.db.models import Q
from rest_framework import viewsets
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Collection, Kalam, Person, Rendition
from .serializers import (
    CollectionSerializer,
    KalamDetailSerializer,
    KalamListSerializer,
    PersonDetailSerializer,
    PersonListSerializer,
    RenditionRefSerializer,
    RenditionSerializer,
)

PUBLIC = ["public", "unlisted"]
SEARCH_LIMIT = 20


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


class SearchView(APIView):
    """GET /api/v1/search/?q= → grouped public results.

    DB-agnostic case-insensitive matching (icontains) so it works on SQLite and
    Postgres alike; Postgres FTS/trigram is a later optimisation (plan §8). Only
    public/unlisted records are ever returned.
    """

    permission_classes = []  # public

    def get(self, request):
        q = request.query_params.get("q", "").strip()
        empty = {"kalams": [], "people": [], "renditions": [], "collections": []}
        if not q:
            return Response(empty)

        kalams = (
            Kalam.objects.filter(visibility__in=PUBLIC)
            .filter(
                Q(title__icontains=q)
                | Q(title_native__icontains=q)
                | Q(title_transliterated__icontains=q)
                | Q(summary__icontains=q)
            )
            .select_related("author", "genre")[:SEARCH_LIMIT]
        )
        people = (
            Person.objects.filter(visibility__in=PUBLIC)
            .filter(Q(name__icontains=q) | Q(name_native__icontains=q))[:SEARCH_LIMIT]
        )
        renditions = (
            Rendition.objects.filter(visibility__in=PUBLIC)
            .filter(Q(title__icontains=q) | Q(album__icontains=q) | Q(publisher__icontains=q))
            .select_related("kalam")[:SEARCH_LIMIT]
        )
        collections = (
            Collection.objects.filter(visibility__in=PUBLIC)
            .filter(Q(title__icontains=q) | Q(description__icontains=q))[:SEARCH_LIMIT]
        )
        return Response({
            "kalams": KalamListSerializer(kalams, many=True).data,
            "people": PersonListSerializer(people, many=True).data,
            "renditions": RenditionRefSerializer(renditions, many=True).data,
            "collections": CollectionSerializer(collections, many=True).data,
        })
