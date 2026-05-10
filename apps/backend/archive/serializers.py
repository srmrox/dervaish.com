from rest_framework import serializers

from catalog.serializers import CollectionSummarySerializer, PersonSummarySerializer, TrackSummarySerializer

from .models import ArchiveRecord, Citation, ProvenanceRecord, SourceRating, VocabularyTerm


class VocabularyTermSerializer(serializers.ModelSerializer):
    class Meta:
        model = VocabularyTerm
        fields = ["id", "vocabulary", "code", "label", "uri", "description"]


class CitationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Citation
        fields = ["id", "title", "source_type", "author", "published_at", "url", "note"]


class ProvenanceRecordSerializer(serializers.ModelSerializer):
    media_asset_id = serializers.IntegerField(source="media_asset.id", read_only=True)

    class Meta:
        model = ProvenanceRecord
        fields = [
            "id",
            "event_type",
            "source_name",
            "source_url",
            "source_identifier",
            "checksum_sha256",
            "note",
            "metadata",
            "media_asset_id",
            "created_at",
        ]


class SourceRatingSerializer(serializers.ModelSerializer):
    contributor_name = serializers.CharField(source="contributor.display_name", read_only=True)

    class Meta:
        model = SourceRating
        fields = ["id", "kind", "value", "max_value", "rationale", "contributor_name", "created_at"]


class ArchiveRecordSummarySerializer(serializers.ModelSerializer):
    terms = VocabularyTermSerializer(many=True, read_only=True)

    class Meta:
        model = ArchiveRecord
        fields = ["id", "title", "slug", "summary", "visibility", "terms", "updated_at"]


class ArchiveRecordDetailSerializer(ArchiveRecordSummarySerializer):
    tracks = TrackSummarySerializer(many=True, read_only=True)
    people = PersonSummarySerializer(many=True, read_only=True)
    collections = CollectionSummarySerializer(many=True, read_only=True)
    citations = CitationSerializer(many=True, read_only=True)
    provenance_records = ProvenanceRecordSerializer(many=True, read_only=True)
    source_ratings = SourceRatingSerializer(many=True, read_only=True)

    class Meta(ArchiveRecordSummarySerializer.Meta):
        fields = ArchiveRecordSummarySerializer.Meta.fields + [
            "editorial_notes",
            "contributor_notes",
            "tracks",
            "people",
            "collections",
            "citations",
            "provenance_records",
            "source_ratings",
        ]


class ArchiveRecordJsonLdSerializer(serializers.ModelSerializer):
    def to_representation(self, instance):
        request = self.context.get("request")
        base_url = request.build_absolute_uri("/")[:-1] if request else ""
        record_url = f"{base_url}/api/archive/records/{instance.slug}/"
        return {
            "@context": {
                "@vocab": "https://dervaish.org/ns#",
                "schema": "https://schema.org/",
                "dcterms": "http://purl.org/dc/terms/",
                "title": "dcterms:title",
                "description": "dcterms:description",
                "citation": "schema:citation",
                "creator": "schema:creator",
                "isPartOf": "schema:isPartOf",
                "about": "schema:about",
            },
            "@id": record_url,
            "@type": "ArchiveRecord",
            "title": instance.title,
            "description": instance.summary,
            "about": [
                {"@id": f"{base_url}/api/catalog/tracks/{track.slug}/", "title": track.title}
                for track in instance.tracks.filter(visibility="public")
            ],
            "creator": [
                {"@id": f"{base_url}/api/catalog/people/{person.slug}/", "name": person.name, "role": person.primary_role}
                for person in instance.people.filter(visibility="public")
            ],
            "isPartOf": [
                {"@id": f"{base_url}/api/catalog/collections/{collection.slug}/", "title": collection.title}
                for collection in instance.collections.filter(visibility="public")
            ],
            "citation": [
                {
                    "@type": "CreativeWork",
                    "name": citation.title,
                    "url": citation.url,
                    "author": citation.author,
                    "datePublished": citation.published_at,
                }
                for citation in instance.citations.all()
            ],
            "provenance": [
                {
                    "@type": "ProvenanceRecord",
                    "eventType": provenance.event_type,
                    "sourceName": provenance.source_name,
                    "sourceUrl": provenance.source_url,
                    "checksumSha256": provenance.checksum_sha256,
                    "createdAt": provenance.created_at.isoformat(),
                }
                for provenance in instance.provenance_records.all()
            ],
            "keywords": [term.label for term in instance.terms.all()],
            "dateModified": instance.updated_at.isoformat(),
        }

    class Meta:
        model = ArchiveRecord
        fields = ["id"]
