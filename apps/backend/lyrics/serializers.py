from rest_framework import serializers

from .models import LyricLanguage, LyricSegment, LyricSet, UserLyricPreference


class LyricLanguageSerializer(serializers.ModelSerializer):
    class Meta:
        model = LyricLanguage
        fields = ["id", "code", "name", "role", "direction", "display_order", "is_published"]
        read_only_fields = ["id"]


class LyricSegmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = LyricSegment
        fields = ["id", "start_ms", "end_ms", "text_by_language"]
        read_only_fields = ["id"]

    def validate(self, attrs):
        start_ms = attrs.get("start_ms", getattr(self.instance, "start_ms", None))
        end_ms = attrs.get("end_ms", getattr(self.instance, "end_ms", None))
        if start_ms is not None and end_ms is not None and end_ms <= start_ms:
            raise serializers.ValidationError({"end_ms": "End time must be greater than start time."})
        return attrs


class LyricSetSerializer(serializers.ModelSerializer):
    languages = LyricLanguageSerializer(many=True, read_only=True)
    segments = LyricSegmentSerializer(many=True, read_only=True)

    class Meta:
        model = LyricSet
        fields = ["id", "track", "title", "source", "status", "version", "is_canonical", "languages", "segments", "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at"]


class LyricImportSerializer(serializers.Serializer):
    language_id = serializers.IntegerField()
    format = serializers.ChoiceField(choices=["webvtt", "lrc", "ttml", "json"])
    content = serializers.CharField()
    replace_existing = serializers.BooleanField(default=True)


class UserLyricPreferenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserLyricPreference
        fields = ["id", "user", "track", "visible_language_ids", "updated_at"]
        read_only_fields = ["id", "user", "track", "updated_at"]
