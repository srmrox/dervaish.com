from rest_framework import permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet

from community.services import audit

from .models import VideoGenerationJob
from .serializers import VideoGenerationJobSerializer
from .services import cancel_job, publish_job, queue_video_generation


class VideoGenerationJobViewSet(ModelViewSet):
    serializer_class = VideoGenerationJobSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        queryset = VideoGenerationJob.objects.select_related(
            "requested_by",
            "submission",
            "track",
            "source_asset",
            "lyric_set",
            "preview_asset",
            "output_asset",
        ).order_by("-created_at")
        user = self.request.user
        if user.is_authenticated and (user.is_staff or getattr(user, "role", "") in {"editor", "admin"}):
            return queryset
        if user.is_authenticated:
            return queryset.filter(requested_by=user)
        return queryset.none()

    def perform_create(self, serializer):
        job = serializer.save(requested_by=self.request.user)
        queue_video_generation(job)
        audit(self.request.user, "video_generation.create", job, after={"status": job.status}, request=self.request)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        job = cancel_job(self.get_object())
        audit(request.user, "video_generation.cancel", job, after={"status": job.status}, request=request)
        return Response(VideoGenerationJobSerializer(job, context={"request": request}).data)

    @action(detail=True, methods=["post"])
    def publish(self, request, pk=None):
        try:
            job = publish_job(self.get_object())
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        audit(request.user, "video_generation.publish", job, after={"published_at": job.published_at.isoformat()}, request=request)
        return Response(VideoGenerationJobSerializer(job, context={"request": request}).data)
