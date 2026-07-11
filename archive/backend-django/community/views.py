from __future__ import annotations

from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from .models import KalamRequest, RequestUpvote, Submission
from .serializers import KalamRequestSerializer, SubmissionSerializer


class SubmissionViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    """Contributor submissions. `payload` carries {kind, ...} for every Studio
    micro-task (source / transcription / timing / translation / context).
    List/retrieve are scoped to the caller; admins review elsewhere (Phase 4)."""

    serializer_class = SubmissionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Submission.objects.filter(author=self.request.user).order_by("-created_at")

    def perform_create(self, serializer):
        serializer.save(author=self.request.user, status=Submission.Status.SUBMITTED)


class KalamRequestViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    """Community requests for missing/improved material, with upvotes."""

    serializer_class = KalamRequestSerializer
    queryset = KalamRequest.objects.all().order_by("-created_at")

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [AllowAny()]
        return [IsAuthenticated()]

    def perform_create(self, serializer):
        serializer.save(requested_by=self.request.user)

    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated])
    def upvote(self, request, pk=None):
        req = self.get_object()
        obj, created = RequestUpvote.objects.get_or_create(request=req, user=request.user)
        if not created:
            obj.delete()
        return Response({"upvotes": req.upvotes.count(), "has_upvoted": created})
