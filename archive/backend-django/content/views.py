from __future__ import annotations

from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from catalog.models import Kalam
from community.permissions import IsEditor

from .models import Annotation, PublishedFile
from .serializers import AnnotationSerializer, PublishedFileSerializer
from .services import publish_kalam


class AnnotationViewSet(
    mixins.CreateModelMixin, mixins.ListModelMixin, viewsets.GenericViewSet
):
    """Wiki prose annotations (kalam/verse/rendition). Create = contributor+."""

    serializer_class = AnnotationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Annotation.objects.all().order_by("-created_at")


class PublishedFileViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    """Editor view of the DB→Markdown publish log, plus a publish action."""

    serializer_class = PublishedFileSerializer
    permission_classes = [IsEditor]
    queryset = PublishedFile.objects.all()

    @action(detail=False, methods=["post"], url_path="publish-kalam/(?P<slug>[^/.]+)")
    def publish_kalam_action(self, request, slug=None):
        kalam = Kalam.objects.get(slug=slug)
        files = publish_kalam(kalam)
        return Response(PublishedFileSerializer(files, many=True).data)
