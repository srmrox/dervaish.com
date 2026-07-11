from __future__ import annotations

from django.utils import timezone
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from community.permissions import IsEditor

from .models import VideoGenerationJob
from .serializers import VideoGenerationJobSerializer
from .services import build_render_payload


class VideoGenerationJobViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    """Editor-managed lyric-video render jobs. Creating queues a job for the
    local 5090 worker; `cancel`/`publish` manage its lifecycle."""

    serializer_class = VideoGenerationJobSerializer
    permission_classes = [IsEditor]
    queryset = VideoGenerationJob.objects.all()

    def perform_create(self, serializer):
        job = serializer.save(requested_by=self.request.user, status=VideoGenerationJob.Status.QUEUED)
        job.render_payload = build_render_payload(job)
        job.save(update_fields=["render_payload", "updated_at"])

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        job = self.get_object()
        job.status = VideoGenerationJob.Status.CANCELLED
        job.save(update_fields=["status", "updated_at"])
        return Response(VideoGenerationJobSerializer(job).data)

    @action(detail=True, methods=["post"])
    def publish(self, request, pk=None):
        job = self.get_object()
        if job.status != VideoGenerationJob.Status.COMPLETED:
            return Response({"detail": "Only completed jobs can be published."}, status=400)
        job.published_at = timezone.now()
        job.save(update_fields=["published_at", "updated_at"])
        return Response(VideoGenerationJobSerializer(job).data)
