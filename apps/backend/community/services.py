from __future__ import annotations

from django.contrib.contenttypes.models import ContentType
from django.db import transaction
from django.utils import timezone

from accounts.models import RoleKind, User
from audit.models import AuditLog
from common.models import ReviewState

from .models import Submission, TrackRequest, TrackRequestStatus, VerificationVote, VerificationVoteValue


def is_editor(user) -> bool:
    return bool(getattr(user, "is_staff", False) or getattr(user, "role", "") in {RoleKind.EDITOR, RoleKind.ADMIN})


def audit(actor, action: str, target, *, before=None, after=None, request=None) -> AuditLog:
    request_meta = {}
    if request is not None:
        request_meta = {
            "path": request.path,
            "method": request.method,
            "remote_addr": request.META.get("REMOTE_ADDR", ""),
        }
    return AuditLog.objects.create(
        actor=actor if getattr(actor, "is_authenticated", False) else None,
        action=action,
        content_type=ContentType.objects.get_for_model(target),
        object_id=str(target.pk),
        before=before or {},
        after=after or {},
        request_meta=request_meta,
    )


def adjust_trust(user: User | None, delta: int) -> None:
    if not user or delta == 0:
        return
    user.trust_score = max(0, user.trust_score + delta)
    user.save(update_fields=["trust_score"])


def submit_submission(submission: Submission, actor, request=None) -> Submission:
    before = {"status": submission.status}
    submission.status = ReviewState.SUBMITTED
    submission.save(update_fields=["status", "updated_at"])
    audit(actor, "submission.submit", submission, before=before, after={"status": submission.status}, request=request)
    return submission


@transaction.atomic
def review_submission(submission: Submission, actor, status: str, request=None) -> Submission:
    before = {"status": submission.status}
    submission.status = status
    submission.reviewed_by = actor if getattr(actor, "is_authenticated", False) else None
    submission.reviewed_at = timezone.now()
    submission.save(update_fields=["status", "reviewed_by", "reviewed_at", "updated_at"])
    if status == ReviewState.APPROVED:
        adjust_trust(submission.submitter, 5)
    elif status == ReviewState.REJECTED:
        adjust_trust(submission.submitter, -2)
    audit(actor, "submission.review", submission, before=before, after={"status": submission.status}, request=request)
    return submission


@transaction.atomic
def publish_submission(submission: Submission, actor, request=None) -> Submission:
    before = {"status": submission.status}
    submission.status = ReviewState.PUBLISHED
    submission.reviewed_by = actor if getattr(actor, "is_authenticated", False) else submission.reviewed_by
    submission.reviewed_at = timezone.now()
    submission.save(update_fields=["status", "reviewed_by", "reviewed_at", "updated_at"])
    adjust_trust(submission.submitter, 10)
    audit(actor, "submission.publish", submission, before=before, after={"status": submission.status}, request=request)
    return submission


@transaction.atomic
def upsert_verification_vote(submission: Submission, actor, *, field: str, vote: str, note: str = "", request=None) -> VerificationVote:
    verification, created = VerificationVote.objects.update_or_create(
        submission=submission,
        voter=actor,
        field=field,
        defaults={"vote": vote, "note": note},
    )
    if created or vote == VerificationVoteValue.VERIFY:
        adjust_trust(actor, 1)
    audit(
        actor,
        "submission.verify" if vote == VerificationVoteValue.VERIFY else "submission.dispute",
        submission,
        after={"field": field, "vote": vote},
        request=request,
    )
    return verification


def update_track_request_status(track_request: TrackRequest, actor, status: str, request=None) -> TrackRequest:
    before = {"status": track_request.status}
    track_request.status = status
    track_request.save(update_fields=["status", "updated_at"])
    if status == TrackRequestStatus.FULFILLED:
        adjust_trust(track_request.requester, 2)
    audit(actor, "track_request.status", track_request, before=before, after={"status": status}, request=request)
    return track_request
