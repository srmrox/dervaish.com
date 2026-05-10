from rest_framework import serializers

from archive.models import ArchiveRecord
from media.serializers import CaptionSerializer, ChapterSerializer, MediaAssetSerializer, MediaDerivativeSerializer, MediaRenditionSerializer

from .models import Collection, Person, Track, TrackCredit


class TrackCreditSerializer(serializers.ModelSerializer):
    person_id = serializers.IntegerField(source="person.id", read_only=True)
    person_name = serializers.CharField(source="person.name", read_only=True)
    person_slug = serializers.SlugField(source="person.slug", read_only=True)

    class Meta:
        model = TrackCredit
        fields = ["id", "role", "display_order", "note", "person_id", "person_name", "person_slug"]


class CollectionSummarySerializer(serializers.ModelSerializer):
    track_count = serializers.IntegerField(source="tracks.count", read_only=True)

    class Meta:
        model = Collection
        fields = ["id", "title", "slug", "visibility", "is_curated", "track_count", "updated_at"]


class PersonSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = Person
        fields = ["id", "name", "slug", "aliases", "primary_role", "origin", "visibility"]


class TrackSummarySerializer(serializers.ModelSerializer):
    collection = CollectionSummarySerializer(read_only=True)
    credits = TrackCreditSerializer(many=True, read_only=True)

    class Meta:
        model = Track
        fields = [
            "id",
            "title",
            "slug",
            "visibility",
            "duration_ms",
            "primary_language_code",
            "published_at",
            "collection",
            "credits",
        ]


class PersonDetailSerializer(PersonSummarySerializer):
    tracks = serializers.SerializerMethodField()
    archive_records = serializers.SerializerMethodField()

    class Meta(PersonSummarySerializer.Meta):
        fields = PersonSummarySerializer.Meta.fields + ["biography", "external_ids", "tracks", "archive_records"]

    def get_tracks(self, obj):
        tracks = Track.objects.filter(credits__person=obj, visibility="public").distinct().prefetch_related("credits__person", "collection")
        return TrackSummarySerializer(tracks, many=True, context=self.context).data

    def get_archive_records(self, obj):
        records = obj.archive_records.filter(visibility="public")
        return [{"id": record.id, "title": record.title, "slug": record.slug, "summary": record.summary} for record in records]


class CollectionDetailSerializer(CollectionSummarySerializer):
    tracks = TrackSummarySerializer(many=True, read_only=True)
    archive_records = serializers.SerializerMethodField()

    class Meta(CollectionSummarySerializer.Meta):
        fields = CollectionSummarySerializer.Meta.fields + ["tracks", "archive_records"]

    def get_archive_records(self, obj):
        records = obj.archive_records.filter(visibility="public")
        return [{"id": record.id, "title": record.title, "slug": record.slug, "summary": record.summary} for record in records]


class PlaybackManifestSerializer(serializers.ModelSerializer):
    preferred_asset = serializers.SerializerMethodField()
    renditions = serializers.SerializerMethodField()
    captions = CaptionSerializer(many=True, read_only=True)
    chapters = ChapterSerializer(many=True, read_only=True)
    derivatives = serializers.SerializerMethodField()
    lyric_set = serializers.SerializerMethodField()

    class Meta:
        model = Track
        fields = [
            "id",
            "title",
            "duration_ms",
            "primary_language_code",
            "preferred_asset",
            "renditions",
            "derivatives",
            "captions",
            "chapters",
            "lyric_set",
        ]

    def get_preferred_asset(self, obj):
        asset = obj.media_assets.filter(kind="audio", status="ready").first() or obj.media_assets.filter(status="ready").first()
        if not asset:
            return None
        return MediaAssetSerializer(asset, context=self.context).data

    def get_renditions(self, obj):
        asset = obj.media_assets.filter(kind="audio", status="ready").first() or obj.media_assets.filter(status="ready").first()
        if not asset:
            return []
        return MediaRenditionSerializer(asset.renditions.filter(status="ready", is_playable=True), many=True, context=self.context).data

    def get_derivatives(self, obj):
        asset = obj.media_assets.filter(status="ready").first()
        if not asset:
            return []
        return MediaDerivativeSerializer(asset.derivatives.filter(status="ready"), many=True, context=self.context).data

    def get_lyric_set(self, obj):
        lyric_set = obj.lyric_sets.filter(is_canonical=True).prefetch_related("languages", "segments").first()
        if not lyric_set:
            return None
        return {
            "id": lyric_set.id,
            "version": lyric_set.version,
            "languages": [
                {
                    "id": language.id,
                    "code": language.code,
                    "name": language.name,
                    "role": language.role,
                    "direction": language.direction,
                    "is_published": language.is_published,
                }
                for language in lyric_set.languages.all()
            ],
            "segments": [
                {
                    "id": segment.id,
                    "start_ms": segment.start_ms,
                    "end_ms": segment.end_ms,
                    "text_by_language": segment.text_by_language,
                }
                for segment in lyric_set.segments.all()
            ],
        }


class TrackDetailSerializer(TrackSummarySerializer):
    media_assets = MediaAssetSerializer(many=True, read_only=True)
    archive_records = serializers.SerializerMethodField()

    class Meta(TrackSummarySerializer.Meta):
        fields = TrackSummarySerializer.Meta.fields + ["media_assets", "archive_records"]

    def get_archive_records(self, obj):
        records = ArchiveRecord.objects.filter(tracks=obj, visibility="public")
        return [{"id": record.id, "title": record.title, "slug": record.slug, "summary": record.summary} for record in records]
