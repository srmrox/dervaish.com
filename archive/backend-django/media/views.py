"""Media upload + processing API (master plan §11.2, §12).

Flow: create an upload session → upload bytes (presigned S3 PUT in prod, or a
server-mediated POST in dev) → complete to enqueue transcoding. Staff/editors
can list assets and watch processing status.
"""
from __future__ import annotations

from django.core.files.storage import default_storage
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsContributor, IsEditor

from . import storage
from .models import MediaAsset, ProcessingStatus
from .serializers import MediaAssetSerializer, UploadSessionCreateSerializer
from .tasks import process_media_asset


class UploadSessionView(APIView):
    """POST /api/v1/media/upload-sessions/ → pending asset + upload target."""

    permission_classes = [IsContributor]

    def post(self, request):
        serializer = UploadSessionCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        asset = MediaAsset.objects.create(
            kind=data["kind"],
            mime_type=data["mime_type"],
            size_bytes=data.get("size_bytes", 0),
            original_filename=data.get("original_filename", ""),
            processing_status=ProcessingStatus.PENDING,
        )
        ext = storage.guess_ext(data["mime_type"], data.get("original_filename", ""))
        key = storage.original_key_for(asset.kind, asset.id, ext)
        asset.storage_key = key
        asset.save(update_fields=["storage_key"])

        upload_url = storage.presigned_put_url(key, data["mime_type"])
        return Response(
            {
                "asset_id": asset.id,
                "storage_key": key,
                # In prod: PUT bytes to upload_url. In dev (no S3): POST the file to upload_path.
                "upload_url": upload_url,
                "upload_method": "PUT" if upload_url else "POST",
                "upload_path": None if upload_url else f"/api/v1/media/assets/{asset.id}/upload/",
                "complete_path": f"/api/v1/media/assets/{asset.id}/complete/",
            },
            status=status.HTTP_201_CREATED,
        )


class MediaAssetViewSet(viewsets.ReadOnlyModelViewSet):
    """GET /api/v1/media/assets/[{id}/] (editor+), plus upload/complete actions."""

    serializer_class = MediaAssetSerializer
    permission_classes = [IsEditor]

    def get_queryset(self):
        return MediaAsset.objects.prefetch_related("variants").order_by("-created_at")

    @action(detail=True, methods=["post"], permission_classes=[IsContributor],
            parser_classes=[MultiPartParser, FormParser])
    def upload(self, request, pk=None):
        """Server-mediated upload fallback when object storage isn't presigned (dev)."""
        asset = MediaAsset.objects.get(pk=pk)
        file_obj = request.FILES.get("file")
        if not file_obj:
            return Response({"detail": "No file provided."}, status=400)
        if default_storage.exists(asset.storage_key):
            default_storage.delete(asset.storage_key)
        default_storage.save(asset.storage_key, file_obj)
        asset.size_bytes = file_obj.size
        asset.save(update_fields=["size_bytes"])
        return Response({"asset_id": asset.id, "storage_key": asset.storage_key})

    @action(detail=True, methods=["post"], permission_classes=[IsContributor])
    def complete(self, request, pk=None):
        """Mark the upload complete and enqueue processing."""
        asset = MediaAsset.objects.get(pk=pk)
        process_media_asset.delay(asset.id)
        asset.refresh_from_db()
        return Response(MediaAssetSerializer(asset).data, status=status.HTTP_202_ACCEPTED)
