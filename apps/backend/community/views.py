from django.db.models import Q
from rest_framework import permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet

from common.models import ReviewState

from .models import CorrectionDraft, Submission, TrackRequest, TrackRequestVote
from .serializers import (
    CorrectionDraftSerializer,
    SubmissionReviewSerializer,
    SubmissionSerializer,
    TrackRequestSerializer,
    TrackRequestStatusSerializer,
    VerificationVoteInputSerializer,
    VerificationVoteSerializer,
)
from .services import audit, is_editor, publish_submission, review_submission, submit_submission, update_track_request_status, upsert_verification_vote


class IsAuthenticatedOrReadVisible(permissions.BasePermission):
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        return bool(request.user and request.user.is_authenticated)


class SubmissionViewSet(ModelViewSet):
    serializer_class = SubmissionSerializer
    permission_classes = [IsAuthenticatedOrReadVisible]

    def get_queryset(self):
        queryset = Submission.objects.select_related("submitter", "lyric_set", "reviewed_by").prefetch_related(
            "citations",
            "media_assets",
            "correction_drafts",
            "verification_votes__voter",
        )
        user = self.request.user
        if is_editor(user):
            return queryset.order_by("-created_at")
        visible_states = [ReviewState.SUBMITTED, ReviewState.UNDER_REVIEW, ReviewState.CHANGES_REQUESTED, ReviewState.APPROVED, ReviewState.PUBLISHED]
        if user.is_authenticated:
            return queryset.filter(Q(status__in=visible_states) | Q(submitter=user)).order_by("-created_at")
        return queryset.filter(status__in=visible_states).order_by("-created_at")

    def perform_create(self, serializer):
        submission = serializer.save(submitter=self.request.user)
        audit(self.request.user, "submission.create", submission, after={"status": submission.status}, request=self.request)

    @action(detail=True, methods=["post"])
    def submit(self, request, pk=None):
        submission = submit_submission(self.get_object(), request.user, request=request)
        return Response(SubmissionSerializer(submission, context={"request": request}).data)

    @action(detail=True, methods=["patch"])
    def review(self, request, pk=None):
        if not is_editor(request.user):
            return Response({"detail": "Editor role required."}, status=status.HTTP_403_FORBIDDEN)
        serializer = SubmissionReviewSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        submission = review_submission(self.get_object(), request.user, serializer.validated_data["status"], request=request)
        return Response(SubmissionSerializer(submission, context={"request": request}).data)

    @action(detail=True, methods=["post"])
    def publish(self, request, pk=None):
        if not is_editor(request.user):
            return Response({"detail": "Editor role required."}, status=status.HTTP_403_FORBIDDEN)
        submission = publish_submission(self.get_object(), request.user, request=request)
        return Response(SubmissionSerializer(submission, context={"request": request}).data)

    @action(detail=True, methods=["post"])
    def corrections(self, request, pk=None):
        submission = self.get_object()
        serializer = CorrectionDraftSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        correction = serializer.save(submission=submission)
        audit(request.user, "correction.create", correction, after={"fields": correction.fields}, request=request)
        return Response(CorrectionDraftSerializer(correction).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def verifications(self, request, pk=None):
        serializer = VerificationVoteInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        vote = upsert_verification_vote(self.get_object(), request.user, **serializer.validated_data, request=request)
        return Response(VerificationVoteSerializer(vote).data)


class CorrectionDraftViewSet(ModelViewSet):
    queryset = CorrectionDraft.objects.select_related("submission", "target_track", "target_archive_record").order_by("-created_at")
    serializer_class = CorrectionDraftSerializer
    permission_classes = [IsAuthenticatedOrReadVisible]


class TrackRequestViewSet(ModelViewSet):
    serializer_class = TrackRequestSerializer
    permission_classes = [IsAuthenticatedOrReadVisible]

    def get_queryset(self):
        queryset = TrackRequest.objects.select_related("requester", "target_track").prefetch_related("votes").order_by("-created_at")
        user = self.request.user
        if is_editor(user):
            return queryset
        return queryset.exclude(status="rejected")

    def perform_create(self, serializer):
        track_request = serializer.save(requester=self.request.user)
        audit(self.request.user, "track_request.create", track_request, after={"status": track_request.status}, request=self.request)

    @action(detail=True, methods=["post"])
    def upvote(self, request, pk=None):
        track_request = self.get_object()
        vote, created = TrackRequestVote.objects.get_or_create(request=track_request, user=request.user)
        if not created:
            vote.delete()
            audit(request.user, "track_request.unvote", track_request, request=request)
        else:
            audit(request.user, "track_request.upvote", track_request, request=request)
        track_request.refresh_from_db()
        return Response(TrackRequestSerializer(track_request, context={"request": request}).data)

    @action(detail=True, methods=["patch"])
    def status(self, request, pk=None):
        if not is_editor(request.user):
            return Response({"detail": "Editor role required."}, status=status.HTTP_403_FORBIDDEN)
        serializer = TrackRequestStatusSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        track_request = self.get_object()
        track_request.moderator_note = serializer.validated_data.get("moderator_note", track_request.moderator_note)
        track_request.save(update_fields=["moderator_note", "updated_at"])
        track_request = update_track_request_status(track_request, request.user, serializer.validated_data["status"], request=request)
        return Response(TrackRequestSerializer(track_request, context={"request": request}).data)
