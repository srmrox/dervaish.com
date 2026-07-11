from rest_framework import serializers

from .models import ContentSource, MediaMirror


class ContentSourceSerializer(serializers.ModelSerializer):
    class Meta:
        model = ContentSource
        fields = (
            "slug", "name", "description", "base_url", "kind",
            "icon_url", "is_official", "is_default", "verified", "priority",
        )


class MediaMirrorSerializer(serializers.ModelSerializer):
    class Meta:
        model = MediaMirror
        fields = (
            "slug", "name", "base_url", "kind", "notes",
            "is_official", "is_default_enabled", "verified", "carries_all", "priority",
        )
