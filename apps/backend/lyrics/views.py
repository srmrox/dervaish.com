from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from rest_framework import permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet

from catalog.models import Track

from .models import LyricLanguage, LyricSegment, LyricSet, UserLyricPreference
from .serializers import LyricImportSerializer, LyricLanguageSerializer, LyricSegmentSerializer, LyricSetSerializer, UserLyricPreferenceSerializer
from .services import export_lyric_document, parse_lyric_document


class LyricSetViewSet(ModelViewSet):
    queryset = LyricSet.objects.select_related("track").prefetch_related("languages", "segments").order_by("-updated_at")
    serializer_class = LyricSetSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    @action(detail=True, methods=["post"], url_path="languages")
    def add_language(self, request, pk=None):
        lyric_set = self.get_object()
        serializer = LyricLanguageSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        language = serializer.save(lyric_set=lyric_set)
        return Response(LyricLanguageSerializer(language).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["put"], url_path="segments")
    def replace_segments(self, request, pk=None):
        lyric_set = self.get_object()
        serializer = LyricSegmentSerializer(data=request.data.get("segments", []), many=True)
        serializer.is_valid(raise_exception=True)
        LyricSegment.objects.filter(lyric_set=lyric_set).delete()
        segments = [LyricSegment.objects.create(lyric_set=lyric_set, **segment) for segment in serializer.validated_data]
        return Response(LyricSegmentSerializer(segments, many=True).data)

    @action(detail=True, methods=["post"], url_path="import")
    def import_document(self, request, pk=None):
        lyric_set = self.get_object()
        serializer = LyricImportSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        language = get_object_or_404(lyric_set.languages, id=serializer.validated_data["language_id"])
        parsed_segments = parse_lyric_document(serializer.validated_data["content"], serializer.validated_data["format"], str(language.id))
        if serializer.validated_data["replace_existing"]:
            LyricSegment.objects.filter(lyric_set=lyric_set).delete()
        segments = [LyricSegment.objects.create(lyric_set=lyric_set, **segment) for segment in parsed_segments]
        return Response(LyricSegmentSerializer(segments, many=True).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get"], url_path=r"export/(?P<export_format>webvtt|lrc|ttml|json)")
    def export_document(self, request, pk=None, export_format=None):
        lyric_set = self.get_object()
        content = export_lyric_document(lyric_set, export_format or "json")
        content_types = {
            "json": "application/json; charset=utf-8",
            "webvtt": "text/vtt; charset=utf-8",
            "lrc": "text/plain; charset=utf-8",
            "ttml": "application/ttml+xml; charset=utf-8",
        }
        return HttpResponse(content, content_type=content_types[export_format or "json"])


class LyricPreferenceViewSet(ModelViewSet):
    serializer_class = UserLyricPreferenceSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return UserLyricPreference.objects.filter(user=self.request.user).select_related("track")

    def retrieve(self, request, pk=None):
        preference = get_object_or_404(self.get_queryset(), track_id=pk)
        return Response(UserLyricPreferenceSerializer(preference).data)

    def update(self, request, pk=None):
        track = get_object_or_404(Track, id=pk)
        visible_language_ids = request.data.get("visible_language_ids", [])
        preference, _ = UserLyricPreference.objects.update_or_create(
            user=request.user,
            track=track,
            defaults={"visible_language_ids": visible_language_ids},
        )
        return Response(UserLyricPreferenceSerializer(preference).data)
