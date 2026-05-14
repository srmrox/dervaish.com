from rest_framework import serializers

from media.serializers import MediaAssetSerializer

from .models import VideoGenerationJob


class VideoGenerationJobSerializer(serializers.ModelSerializer):
    preview_asset = MediaAssetSerializer(read_only=True)
    output_asset = MediaAssetSerializer(read_only=True)

    class Meta:
        model = VideoGenerationJob
        fields = [
            "id",
            "requested_by",
            "submission",
            "track",
            "source_asset",
            "lyric_set",
            "source_mode",
            "layout_id",
            "resolution",
            "visible_language_ids",
            "title",
            "voice",
            "writer",
            "status",
            "celery_task_id",
            "render_payload",
            "log",
            "failure_reason",
            "preview_asset",
            "output_asset",
            "cancelled_at",
            "published_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "requested_by",
            "status",
            "celery_task_id",
            "render_payload",
            "log",
            "failure_reason",
            "preview_asset",
            "output_asset",
            "cancelled_at",
            "published_at",
            "created_at",
            "updated_at",
        ]

    def validate(self, attrs):
        if not attrs.get("submission") and not attrs.get("track"):
            raise serializers.ValidationError("Provide a submission or track.")
        return attrs
