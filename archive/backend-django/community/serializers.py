from __future__ import annotations

from rest_framework import serializers

from .models import KalamRequest, Submission


class SubmissionSerializer(serializers.ModelSerializer):
    author_name = serializers.SerializerMethodField()

    class Meta:
        model = Submission
        fields = [
            "id",
            "title",
            "payload",
            "status",
            "reviewer_note",
            "author_name",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "status",
            "reviewer_note",
            "author_name",
            "created_at",
            "updated_at",
        ]

    def get_author_name(self, obj: Submission) -> str:
        if not obj.author:
            return ""
        return obj.author.display_name or obj.author.username


class KalamRequestSerializer(serializers.ModelSerializer):
    upvotes = serializers.SerializerMethodField()
    has_upvoted = serializers.SerializerMethodField()

    class Meta:
        model = KalamRequest
        fields = [
            "id",
            "title",
            "details",
            "author_hint",
            "reciter_hint",
            "status",
            "upvotes",
            "has_upvoted",
            "created_at",
        ]
        read_only_fields = ["id", "status", "upvotes", "has_upvoted", "created_at"]

    def get_upvotes(self, obj: KalamRequest) -> int:
        return obj.upvotes.count()

    def get_has_upvoted(self, obj: KalamRequest) -> bool:
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False
        return obj.upvotes.filter(user=request.user).exists()
