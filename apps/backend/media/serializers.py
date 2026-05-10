from rest_framework import serializers

from .models import Caption, Chapter, MediaAsset, MediaDerivative, MediaProcessingJob, MediaRendition, UploadSession


class UploadSessionCreateSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=240, allow_blank=True, required=False)
    original_filename = serializers.CharField(max_length=255)
    mime_type = serializers.CharField(max_length=120)
    size_bytes = serializers.IntegerField(min_value=0)
    checksum_sha256 = serializers.RegexField(regex=r"^[A-Fa-f0-9]{64}$", required=False, allow_blank=True)


class MediaRenditionSerializer(serializers.ModelSerializer):
    playback_url = serializers.SerializerMethodField()

    class Meta:
        model = MediaRendition
        fields = ["id", "format", "codec", "bitrate_kbps", "width", "height", "size_bytes", "status", "is_playable", "playback_url"]

    def get_playback_url(self, obj):
        from .services import public_media_url

        return public_media_url(obj.storage_key)


class MediaDerivativeSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()

    class Meta:
        model = MediaDerivative
        fields = ["id", "kind", "format", "metadata", "status", "url"]

    def get_url(self, obj):
        from .services import public_media_url

        return public_media_url(obj.storage_key)


class MediaAssetSerializer(serializers.ModelSerializer):
    renditions = MediaRenditionSerializer(many=True, read_only=True)
    derivatives = MediaDerivativeSerializer(many=True, read_only=True)

    class Meta:
        model = MediaAsset
        fields = [
            "id",
            "title",
            "kind",
            "storage_key",
            "original_filename",
            "mime_type",
            "checksum_sha256",
            "size_bytes",
            "duration_ms",
            "width",
            "height",
            "source_url",
            "is_master",
            "status",
            "metadata",
            "renditions",
            "derivatives",
        ]


class UploadSessionSerializer(serializers.ModelSerializer):
    asset = MediaAssetSerializer(read_only=True)

    class Meta:
        model = UploadSession
        fields = ["id", "status", "upload_url", "expires_at", "expected_checksum_sha256", "expected_size_bytes", "completed_at", "asset"]


class MediaProcessingJobSerializer(serializers.ModelSerializer):
    class Meta:
        model = MediaProcessingJob
        fields = ["id", "asset", "kind", "status", "celery_task_id", "log", "error", "attempts", "started_at", "completed_at", "created_at"]


class CaptionSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()

    class Meta:
        model = Caption
        fields = ["id", "language_code", "label", "format", "is_published", "url"]

    def get_url(self, obj):
        from .services import public_media_url

        return public_media_url(obj.storage_key)


class ChapterSerializer(serializers.ModelSerializer):
    class Meta:
        model = Chapter
        fields = ["id", "title", "language_code", "start_ms", "end_ms", "notes"]
