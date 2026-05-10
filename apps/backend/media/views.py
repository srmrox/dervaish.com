from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet, ReadOnlyModelViewSet, ViewSet

from .models import MediaAsset, MediaProcessingJob, ProcessingStatus, UploadSession, UploadSessionStatus
from .serializers import MediaAssetSerializer, MediaProcessingJobSerializer, UploadSessionCreateSerializer, UploadSessionSerializer
from .services import create_upload_session, queue_asset_processing


class UploadSessionViewSet(ViewSet):
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def create(self, request):
        serializer = UploadSessionCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        session = create_upload_session(user=request.user, **serializer.validated_data)
        return Response(UploadSessionSerializer(session, context={"request": request}).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="complete")
    def complete(self, request, pk=None):
        session = UploadSession.objects.select_related("asset").get(pk=pk)
        if session.status != UploadSessionStatus.PENDING:
            return Response({"detail": "Upload session is not pending."}, status=status.HTTP_400_BAD_REQUEST)
        if session.expires_at < timezone.now():
            session.status = UploadSessionStatus.EXPIRED
            session.save(update_fields=["status", "updated_at"])
            return Response({"detail": "Upload session expired."}, status=status.HTTP_400_BAD_REQUEST)

        asset = session.asset
        asset.status = ProcessingStatus.PROCESSING
        asset.save(update_fields=["status", "updated_at"])
        session.status = UploadSessionStatus.UPLOADED
        session.completed_at = timezone.now()
        session.save(update_fields=["status", "completed_at", "updated_at"])
        job = queue_asset_processing(asset)
        return Response(
            {
                "upload_session": UploadSessionSerializer(session, context={"request": request}).data,
                "processing_job": MediaProcessingJobSerializer(job).data,
            }
        )


class MediaAssetViewSet(ReadOnlyModelViewSet):
    queryset = MediaAsset.objects.prefetch_related("renditions", "derivatives").order_by("-created_at")
    serializer_class = MediaAssetSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    @action(detail=True, methods=["post"], url_path="process")
    def process(self, request, pk=None):
        asset = self.get_object()
        asset.status = ProcessingStatus.PROCESSING
        asset.save(update_fields=["status", "updated_at"])
        job = queue_asset_processing(asset)
        return Response(MediaProcessingJobSerializer(job).data, status=status.HTTP_202_ACCEPTED)


class MediaProcessingJobViewSet(ReadOnlyModelViewSet):
    queryset = MediaProcessingJob.objects.select_related("asset").order_by("-created_at")
    serializer_class = MediaProcessingJobSerializer
    permission_classes = [permissions.IsAdminUser]
