from django.test import TestCase

from accounts.models import User
from community.models import Submission, TrackRequest, TrackRequestVote, VerificationField, VerificationVote, VerificationVoteValue


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
