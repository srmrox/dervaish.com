from django.db.models import Q
from django.http import HttpResponse, JsonResponse
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAdminUser
from rest_framework.response import Response

from archive.models import ArchiveRecord
from archive.serializers import ArchiveRecordDetailSerializer
from catalog.models import Collection, Person, Track
from catalog.serializers import CollectionSummarySerializer, PersonSummarySerializer, TrackSummarySerializer
from common.models import EditorialState
from community.models import Submission, TrackRequest
from media.models import MediaAsset, MediaProcessingJob
from video_generation.models import VideoGenerationJob


@api_view(["GET"])
@permission_classes([AllowAny])
def search(request):
    query = request.query_params.get("q", "").strip()
    if not query:
        return Response({"query": query, "tracks": [], "people": [], "collections": [], "archive_records": []})
    public_filter = Q(visibility=EditorialState.PUBLIC)
    tracks = Track.objects.filter(public_filter, Q(title__icontains=query) | Q(primary_language_code__icontains=query)).prefetch_related("credits__person", "collection")[:10]
    people = Person.objects.filter(public_filter, Q(name__icontains=query) | Q(origin__icontains=query))[:10]
    collections = Collection.objects.filter(public_filter, Q(title__icontains=query))[:10]
    archive_records = ArchiveRecord.objects.filter(public_filter, Q(title__icontains=query) | Q(summary__icontains=query)).prefetch_related("terms")[:10]
    return Response(
        {
            "query": query,
            "tracks": TrackSummarySerializer(tracks, many=True, context={"request": request}).data,
            "people": PersonSummarySerializer(people, many=True, context={"request": request}).data,
            "collections": CollectionSummarySerializer(collections, many=True, context={"request": request}).data,
            "archive_records": [{"id": record.id, "title": record.title, "slug": record.slug, "summary": record.summary} for record in archive_records],
        }
    )


@api_view(["GET"])
@permission_classes([AllowAny])
def export_archive_records(request):
    export_format = request.query_params.get("type", "json").lower()
    records = ArchiveRecord.objects.filter(visibility=EditorialState.PUBLIC).prefetch_related(
        "tracks__credits__person",
        "people",
        "collections",
        "citations",
        "terms",
        "provenance_records",
        "source_ratings__contributor",
    )
    if export_format == "csv":
        lines = ["id,title,slug,citation_count,updated_at"]
        for record in records:
            title = record.title.replace('"', '""')
            lines.append(f'{record.id},"{title}",{record.slug},{record.citations.count()},{record.updated_at.isoformat()}')
        return HttpResponse("\n".join(lines), content_type="text/csv; charset=utf-8")
    return Response(ArchiveRecordDetailSerializer(records, many=True, context={"request": request}).data)


@api_view(["GET"])
@permission_classes([AllowAny])
def readiness(_request):
    return JsonResponse({"ok": True, "database": "available", "service": "dervaish-backend"})


@api_view(["GET"])
@permission_classes([IsAdminUser])
def metrics(_request):
    return Response(
        {
            "catalog": {
                "tracks": Track.objects.count(),
                "people": Person.objects.count(),
                "collections": Collection.objects.count(),
                "archive_records": ArchiveRecord.objects.count(),
            },
            "media": {
                "assets": MediaAsset.objects.count(),
                "processing_jobs": MediaProcessingJob.objects.count(),
            },
            "community": {
                "submissions": Submission.objects.count(),
                "track_requests": TrackRequest.objects.count(),
            },
            "video_generation": {
                "jobs": VideoGenerationJob.objects.count(),
            },
        }
    )
