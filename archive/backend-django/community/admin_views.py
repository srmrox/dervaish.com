from __future__ import annotations

from django.utils import timezone
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import Submission
from .permissions import IsEditor
from .serializers import SubmissionSerializer
from .services import apply_submission


class AdminSubmissionViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    """Editor review queue: list/inspect all submissions, set status, and apply
    an approved submission's payload to canonical models."""

    serializer_class = SubmissionSerializer
    permission_classes = [IsEditor]
    filterset_fields = ["status"]

    def get_queryset(self):
        return Submission.objects.all().select_related("author").order_by("-created_at")

    @action(detail=True, methods=["post"])
    def review(self, request, pk=None):
        """POST {status, reviewer_note?} — set the review outcome."""
        sub = self.get_object()
        status_val = request.data.get("status")
        if status_val in dict(Submission.Status.choices):
            sub.status = status_val
        if "reviewer_note" in request.data:
            sub.reviewer_note = request.data.get("reviewer_note") or ""
        sub.save(update_fields=["status", "reviewer_note", "updated_at"])
        return Response(SubmissionSerializer(sub).data)

    @action(detail=True, methods=["post"])
    def apply(self, request, pk=None):
        """POST — write the payload to canonical models and mark approved."""
        sub = self.get_object()
        result = apply_submission(sub)
        if result.get("applied"):
            sub.status = Submission.Status.APPROVED
            sub.reviewer_note = (sub.reviewer_note + f"\nApplied {timezone.now():%Y-%m-%d %H:%M}").strip()
            sub.save(update_fields=["status", "reviewer_note", "updated_at"])
        return Response(result)
