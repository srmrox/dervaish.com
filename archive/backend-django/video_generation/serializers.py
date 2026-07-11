from __future__ import annotations

from rest_framework import serializers

from .models import VideoGenerationJob


class VideoGenerationJobSerializer(serializers.ModelSerializer):
    rendition_slug = serializers.CharField(source="rendition.slug", read_only=True, default=None)

    class Meta:
        model = VideoGenerationJob
        fields = [
            "id",
            "rendition",
            "rendition_slug",
            "source_mode",
            "layout_id",
            "resolution",
            "visible_language_codes",
            "title",
            "status",
            "output_url",
            "failure_reason",
            "created_at",
        ]
        read_only_fields = ["id", "status", "output_url", "failure_reason", "created_at"]
