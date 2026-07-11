from __future__ import annotations

from rest_framework import serializers

from .models import Annotation, PublishedFile


class AnnotationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Annotation
        fields = [
            "id",
            "target_kind",
            "kalam",
            "verse",
            "rendition",
            "language_code",
            "body_markdown",
            "status",
            "created_at",
        ]
        read_only_fields = ["id", "status", "created_at"]


class PublishedFileSerializer(serializers.ModelSerializer):
    class Meta:
        model = PublishedFile
        fields = [
            "id",
            "entity_type",
            "entity_id",
            "repo_path",
            "content_hash",
            "commit_sha",
            "status",
            "published_at",
            "created_at",
        ]
