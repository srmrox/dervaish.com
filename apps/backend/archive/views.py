from rest_framework import permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.viewsets import ReadOnlyModelViewSet

from common.models import EditorialState

from .models import ArchiveRecord, Citation, ProvenanceRecord, VocabularyTerm
from .serializers import (
    ArchiveRecordDetailSerializer,
    ArchiveRecordJsonLdSerializer,
    ArchiveRecordSummarySerializer,
    CitationSerializer,
    ProvenanceRecordSerializer,
    VocabularyTermSerializer,
)


class PublicArchiveQuerySetMixin:
    public_only = True

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user
        if self.public_only and not (user.is_authenticated and user.is_staff):
            queryset = queryset.filter(visibility=EditorialState.PUBLIC)
        return queryset


class ArchiveRecordViewSet(PublicArchiveQuerySetMixin, ReadOnlyModelViewSet):
    queryset = ArchiveRecord.objects.prefetch_related(
        "tracks__credits__person",
        "tracks__collection",
        "people",
        "collections",
        "citations",
        "terms",
        "provenance_records",
        "source_ratings__contributor",
    ).order_by("title")
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    lookup_field = "slug"

    def get_serializer_class(self):
        if self.action == "retrieve":
            return ArchiveRecordDetailSerializer
        if self.action == "jsonld":
            return ArchiveRecordJsonLdSerializer
        return ArchiveRecordSummarySerializer

    @action(detail=True, methods=["get"], url_path="jsonld")
    def jsonld(self, request, slug=None):
        return Response(ArchiveRecordJsonLdSerializer(self.get_object(), context={"request": request}).data)


class CitationViewSet(ReadOnlyModelViewSet):
    queryset = Citation.objects.order_by("title")
    serializer_class = CitationSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]


class VocabularyTermViewSet(ReadOnlyModelViewSet):
    queryset = VocabularyTerm.objects.order_by("vocabulary", "label")
    serializer_class = VocabularyTermSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]


class ProvenanceRecordViewSet(ReadOnlyModelViewSet):
    queryset = ProvenanceRecord.objects.select_related("archive_record", "media_asset").order_by("-created_at")
    serializer_class = ProvenanceRecordSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
