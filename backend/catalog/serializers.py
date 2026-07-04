from __future__ import annotations

from rest_framework import serializers

from .models import (
    Collection,
    Credit,
    Kalam,
    Person,
    Queue,
    QueueItem,
    Rendition,
    SavedItem,
    Verse,
)


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
        """Manifest of playable variants with resolved mirror URLs (§4A, §federation).

        Each variant carries an ordered `mirrors` list (preferred host first) so
        the client can fail over / honour the user's enabled-mirror choices. `url`
        stays as the primary for simple clients. A media asset whose original lives
        in a GitHub repo (or any external host) is exposed via its normalized
        `source_url` as a directly-playable variant — no transcode needed.
        """
        from federation.github import guess_container, is_github_url, normalize_github_url
        from federation.services import resolve_mirror_urls

        variants = []
        for asset in obj.media_assets.all():
            for v in asset.variants.all():
                mirrors = resolve_mirror_urls(v.storage_key, asset) if v.storage_key else []
                primary = mirrors[0]["url"] if mirrors else (v.url or v.storage_key)
                variants.append({
                    "kind": asset.kind,
                    "container": v.container,
                    "bitrate_kbps": v.bitrate_kbps,
                    "height": v.height,
                    "url": primary,
                    "mirrors": mirrors,
                    "streaming": v.is_streaming,
                    "offline_download": v.is_offline_download,
                    "source": False,
                })
            # External / GitHub-hosted original — playable directly via its source URL.
            if asset.source_url:
                src = normalize_github_url(asset.source_url)
                gh = is_github_url(src)
                variants.append({
                    "kind": asset.kind,
                    "container": guess_container(src),
                    "bitrate_kbps": None,
                    "height": asset.height,
                    "url": src,
                    "mirrors": [{
                        "mirror": "github-source" if gh else "external-source",
                        "name": "GitHub source" if gh else "Original source",
                        "kind": "github" if gh else "external",
                        "url": src,
                        "default_enabled": True,
                        "priority": 10,
                    }],
                    "streaming": True,
                    "offline_download": True,
                    "source": True,
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


# --- User-facing: library + queues (/me/*) ----------------------------------
class RenditionRefSerializer(serializers.ModelSerializer):
    """Compact rendition reference for embedding in library/queue responses."""

    kalam_slug = serializers.CharField(source="kalam.slug", read_only=True)
    kalam_title = serializers.CharField(source="kalam.title", read_only=True)

    class Meta:
        model = Rendition
        fields = ("slug", "title", "kalam_slug", "kalam_title", "duration_ms")


class SavedItemSerializer(serializers.ModelSerializer):
    rendition = serializers.SlugRelatedField(slug_field="slug", queryset=Rendition.objects.all())
    rendition_detail = RenditionRefSerializer(source="rendition", read_only=True)

    class Meta:
        model = SavedItem
        fields = ("id", "rendition", "rendition_detail", "created_at")


class QueueItemSerializer(serializers.ModelSerializer):
    rendition = serializers.SlugRelatedField(slug_field="slug", queryset=Rendition.objects.all())
    rendition_detail = RenditionRefSerializer(source="rendition", read_only=True)

    class Meta:
        model = QueueItem
        fields = ("id", "rendition", "rendition_detail", "position")


class QueueSerializer(serializers.ModelSerializer):
    items = QueueItemSerializer(many=True, read_only=True)

    class Meta:
        model = Queue
        fields = ("id", "name", "items", "created_at")
