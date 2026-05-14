from django.test import TestCase
from rest_framework.test import APIClient

from accounts.models import RoleKind, User
from audit.models import AuditLog
from catalog.models import Collection, Track
from common.models import EditorialState
from community.models import CorrectionDraft, Submission, TrackRequest, TrackRequestVote, VerificationField, VerificationVote, VerificationVoteValue


class CommunityModelSmokeTests(TestCase):
    def test_verification_and_request_votes_are_unique_per_user_target(self):
        user = User.objects.create_user(username="contributor", password="test")
        submission = Submission.objects.create(submitter=user, title="Submitted track")
        request = TrackRequest.objects.create(requester=user, title="Missing track")

        VerificationVote.objects.create(
            submission=submission,
            voter=user,
            field=VerificationField.OVERALL,
            vote=VerificationVoteValue.VERIFY,
        )
        TrackRequestVote.objects.create(request=request, user=user)

        self.assertEqual(submission.verification_votes.count(), 1)
        self.assertEqual(request.votes.count(), 1)


class CommunityWorkflowApiTests(TestCase):
    def setUp(self):
        self.contributor = User.objects.create_user(username="contributor", password="test", role=RoleKind.CONTRIBUTOR)
        self.editor = User.objects.create_user(username="editor", password="test", role=RoleKind.EDITOR, is_staff=True)
        self.collection = Collection.objects.create(title="Community Collection", slug="community-collection", visibility=EditorialState.PUBLIC)
        self.track = Track.objects.create(title="Community Track", slug="community-track", collection=self.collection, visibility=EditorialState.PUBLIC)
        self.client = APIClient()

    def authenticate_contributor(self):
        self.client.force_authenticate(self.contributor)

    def authenticate_editor(self):
        self.client.force_authenticate(self.editor)

    def test_submission_lifecycle_updates_trust_and_audit_log(self):
        self.authenticate_contributor()
        created = self.client.post(
            "/api/submissions/",
            {"title": "Submitted Naat", "voice": "Reciter", "writer": "Writer", "source_name": "Field source"},
            format="json",
        )
        self.assertEqual(created.status_code, 201)
        submission_id = created.data["id"]

        submitted = self.client.post(f"/api/submissions/{submission_id}/submit/")
        self.assertEqual(submitted.status_code, 200)
        self.assertEqual(submitted.data["status"], "submitted")

        self.authenticate_editor()
        reviewed = self.client.patch(f"/api/submissions/{submission_id}/review/", {"status": "approved"}, format="json")
        self.assertEqual(reviewed.status_code, 200)
        self.assertEqual(reviewed.data["status"], "approved")

        published = self.client.post(f"/api/submissions/{submission_id}/publish/")
        self.assertEqual(published.status_code, 200)
        self.assertEqual(published.data["status"], "published")

        self.contributor.refresh_from_db()
        self.assertEqual(self.contributor.trust_score, 15)
        self.assertTrue(AuditLog.objects.filter(action="submission.publish", object_id=str(submission_id)).exists())

    def test_correction_draft_and_verification_vote_upsert(self):
        self.authenticate_contributor()
        submission = Submission.objects.create(submitter=self.contributor, title="Correction submission", status="submitted")

        correction = self.client.post(
            f"/api/submissions/{submission.id}/corrections/",
            {
                "target_track": self.track.id,
                "fields": ["lyrics", "metadata"],
                "proposed_changes": {"title": "Corrected title"},
            },
            format="json",
        )
        self.assertEqual(correction.status_code, 201)
        self.assertEqual(CorrectionDraft.objects.get(id=correction.data["id"]).target_track, self.track)

        first_vote = self.client.post(
            f"/api/submissions/{submission.id}/verifications/",
            {"field": "lyrics", "vote": "verify", "note": "Matches source."},
            format="json",
        )
        replacement_vote = self.client.post(
            f"/api/submissions/{submission.id}/verifications/",
            {"field": "lyrics", "vote": "dispute", "note": "Timing needs work."},
            format="json",
        )

        self.assertEqual(first_vote.status_code, 200)
        self.assertEqual(replacement_vote.status_code, 200)
        self.assertEqual(VerificationVote.objects.filter(submission=submission, voter=self.contributor, field="lyrics").count(), 1)
        self.assertEqual(VerificationVote.objects.get(submission=submission, voter=self.contributor, field="lyrics").vote, "dispute")
        self.assertTrue(AuditLog.objects.filter(action="submission.dispute", object_id=str(submission.id)).exists())

    def test_track_request_upvote_toggle_and_editor_status(self):
        self.authenticate_contributor()
        created = self.client.post(
            "/api/community/track-requests/",
            {"title": "Missing qawwali", "reciter_name": "Unknown reciter", "source_hint": "Community memory"},
            format="json",
        )
        self.assertEqual(created.status_code, 201)
        request_id = created.data["id"]

        upvoted = self.client.post(f"/api/community/track-requests/{request_id}/upvote/")
        self.assertEqual(upvoted.status_code, 200)
        self.assertEqual(upvoted.data["upvote_count"], 1)
        self.assertTrue(upvoted.data["upvoted_by_current_user"])

        unvoted = self.client.post(f"/api/community/track-requests/{request_id}/upvote/")
        self.assertEqual(unvoted.status_code, 200)
        self.assertEqual(unvoted.data["upvote_count"], 0)
        self.assertFalse(unvoted.data["upvoted_by_current_user"])

        self.authenticate_editor()
        fulfilled = self.client.patch(
            f"/api/community/track-requests/{request_id}/status/",
            {"status": "fulfilled", "moderator_note": "Added to acquisition queue."},
            format="json",
        )
        self.assertEqual(fulfilled.status_code, 200)
        self.assertEqual(fulfilled.data["status"], "fulfilled")
        self.contributor.refresh_from_db()
        self.assertEqual(self.contributor.trust_score, 2)
