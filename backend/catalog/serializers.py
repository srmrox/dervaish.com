from __future__ import annotations

from rest_framework import serializers

from .models import Collection, Credit, Kalam, Person, Rendition, Verse


class TermField(serializers.SlugRelatedField):
    def __init__(self, **kwargs):
        kwargs.setdefault("slug_field", "label")
        kwargs.setdefault("read_only", True)
        super().__init__(**kwargs)


class CreditSerializer(serializers.ModelSerializer):
    person_name = serializers.CharField(source="person.name", read_only=True)
    person_slug = serializers.CharField(source="person.slug", read_only=True)

    class Meta:
        model = Credit
        fields = ("role", "person_name", "person_slug", "display_order", "note")


class VerseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Verse
        fields = ("order", "text_native", "transliteration", "translations", "meaning")


class PersonListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Person
        fields = ("slug", "name", "name_native", "era", "region")


class PersonDetailSerializer(serializers.ModelSerializer):
    tradition = TermField()
    authored_kalams = serializers.SerializerMethodField()

    class Meta:
        model = Person
        fields = (
            "slug", "name", "name_native", "aliases", "biography",
            "era", "region", "tradition", "external_ids", "authored_kalams",
        )

    def get_authored_kalams(self, obj):
        qs = obj.authored_kalams.filter(visibility__in=["public", "unlisted"])
        return KalamListSerializer(qs, many=True).data


class RenditionSerializer(serializers.ModelSerializer):
    credits = CreditSerializer(many=True, read_only=True)
    playback = serializers.SerializerMethodField()

    class Meta:
        model = Rendition
        fields = (
            "slug", "title", "duration_ms", "year", "album", "publisher",
            "style", "protection_level", "rights_note", "credits", "playback",
        )

    def get_playback(self, obj):
        """Manifest of playable variants (see Master Build Plan §4A)."""
        variants = []
        for asset in obj.media_assets.all():
            for v in asset.variants.all():
                variants.append({
                    "kind": asset.kind,
                    "container": v.container,
                    "bitrate_kbps": v.bitrate_kbps,
                    "height": v.height,
                    "url": v.url or v.storage_key,
                    "streaming": v.is_streaming,
                    "offline_download": v.is_offline_download,
                })
        return {"protection_level": obj.protection_level, "variants": variants}


class KalamListSerializer(serializers.ModelSerializer):
    author_name = serializers.CharField(source="author.name", read_only=True)
    genre = TermField()

    class Meta:
        model = Kalam
        fields = ("slug", "title", "title_native", "title_transliterated", "author_name", "genre")


class KalamDetailSerializer(serializers.ModelSerializer):
    author = PersonListSerializer(read_only=True)
    primary_language = TermField()
    genre = TermField()
    tradition = TermField()
    themes = TermField(many=True)
    verses = VerseSerializer(many=True, read_only=True)
    renditions = serializers.SerializerMethodField()
    credits = CreditSerializer(many=True, read_only=True)

    class Meta:
        model = Kalam
        fields = (
            "slug", "title", "title_native", "title_transliterated", "summary",
            "author", "primary_language", "genre", "tradition", "era", "themes",
            "tags", "verses", "credits", "renditions",
        )

    def get_renditions(self, obj):
        qs = obj.renditions.filter(visibility__in=["public", "unlisted"])
        return RenditionSerializer(qs, many=True).data


class CollectionSerializer(serializers.ModelSerializer):
    rendition_count = serializers.IntegerField(source="renditions.count", read_only=True)

    class Meta:
        model = Collection
        fields = ("slug", "title", "description", "is_curated", "rendition_count")
