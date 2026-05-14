from rest_framework import serializers

from .models import CorrectionDraft, Submission, TrackRequest, TrackRequestVote, VerificationField, VerificationVote, VerificationVoteValue


class VerificationVoteSerializer(serializers.ModelSerializer):
    voter_name = serializers.CharField(source="voter.display_name", read_only=True)

    class Meta:
        model = VerificationVote
        fields = ["id", "field", "vote", "note", "voter", "voter_name", "created_at", "updated_at"]
        read_only_fields = ["id", "voter", "voter_name", "created_at", "updated_at"]


class VerificationVoteInputSerializer(serializers.Serializer):
    field = serializers.ChoiceField(choices=VerificationField.choices)
    vote = serializers.ChoiceField(choices=VerificationVoteValue.choices)
    note = serializers.CharField(required=False, allow_blank=True, max_length=2000)


class CorrectionDraftSerializer(serializers.ModelSerializer):
    class Meta:
        model = CorrectionDraft
        fields = ["id", "submission", "target_track", "target_archive_record", "fields", "proposed_changes", "status", "created_at", "updated_at"]
        read_only_fields = ["id", "submission", "status", "created_at", "updated_at"]


class SubmissionSerializer(serializers.ModelSerializer):
    correction_drafts = CorrectionDraftSerializer(many=True, read_only=True)
    verification_votes = VerificationVoteSerializer(many=True, read_only=True)
    verification_summary = serializers.SerializerMethodField()
    submitter_name = serializers.CharField(source="submitter.display_name", read_only=True)

    class Meta:
        model = Submission
        fields = [
            "id",
            "submitter",
            "submitter_name",
            "title",
            "voice",
            "writer",
            "source_name",
            "notes",
            "status",
            "citations",
            "media_assets",
            "lyric_set",
            "reviewed_by",
            "reviewed_at",
            "correction_drafts",
            "verification_votes",
            "verification_summary",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "submitter", "reviewed_by", "reviewed_at", "created_at", "updated_at"]

    def get_verification_summary(self, obj):
        summary = {field: {"verify": 0, "dispute": 0} for field, _label in VerificationField.choices}
        for vote in obj.verification_votes.all():
            summary[vote.field][vote.vote] += 1
        return summary


class SubmissionReviewSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=["under_review", "changes_requested", "approved", "rejected"])


class TrackRequestSerializer(serializers.ModelSerializer):
    upvote_count = serializers.SerializerMethodField()
    upvoted_by_current_user = serializers.SerializerMethodField()
    requester_name = serializers.CharField(source="requester.display_name", read_only=True)

    class Meta:
        model = TrackRequest
        fields = [
            "id",
            "requester",
            "requester_name",
            "title",
            "target_track",
            "reciter_name",
            "writer_name",
            "source_hint",
            "status",
            "moderator_note",
            "upvote_count",
            "upvoted_by_current_user",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "requester", "upvote_count", "upvoted_by_current_user", "created_at", "updated_at"]

    def get_upvote_count(self, obj):
        return obj.votes.count()

    def get_upvoted_by_current_user(self, obj):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if not user or not user.is_authenticated:
            return False
        return obj.votes.filter(user=user).exists()


class TrackRequestStatusSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=["open", "planned", "fulfilled", "duplicate", "rejected"])
    moderator_note = serializers.CharField(required=False, allow_blank=True, max_length=2000)
