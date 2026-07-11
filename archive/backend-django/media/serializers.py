from __future__ import annotations

from rest_framework import serializers

from .models import MediaAsset, MediaKind, MediaRendition


class UploadSessionCreateSerializer(serializers.Serializer):
    kind = serializers.ChoiceField(choices=MediaKind.choices)
    mime_type = serializers.CharField(max_length=120)
    size_bytes = serializers.IntegerField(min_value=0, default=0)
    original_filename = serializers.CharField(max_length=300, required=False, allow_blank=True)


class MediaRenditionSerializer(serializers.ModelSerializer):
    class Meta:
        model = MediaRendition
        fields = (
            "id", "container", "codec", "bitrate_kbps", "height",
            "storage_key", "is_streaming", "is_offline_download", "processing_status",
        )


class MediaAssetSerializer(serializers.ModelSerializer):
    variants = MediaRenditionSerializer(many=True, read_only=True)

    class Meta:
        model = MediaAsset
        fields = (
            "id", "kind", "processing_status", "processing_error", "processing_attempts",
            "mime_type", "duration_ms", "width", "height", "storage_key", "source_url",
            "original_filename", "variants", "created_at", "updated_at",
        )
