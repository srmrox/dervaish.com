from django.contrib import admin

from .models import ArchiveRecord, Citation, ProvenanceRecord, SourceRating, VocabularyTerm


class ProvenanceRecordInline(admin.TabularInline):
    model = ProvenanceRecord
    extra = 0
    fields = ("event_type", "source_name", "source_url", "checksum_sha256", "created_at")
    readonly_fields = ("created_at",)


class SourceRatingInline(admin.TabularInline):
    model = SourceRating
    extra = 0
    fields = ("kind", "value", "max_value", "rationale", "contributor", "created_at")
    readonly_fields = ("created_at",)


@admin.register(ArchiveRecord)
class ArchiveRecordAdmin(admin.ModelAdmin):
    inlines = [ProvenanceRecordInline, SourceRatingInline]
    list_display = ("title", "visibility", "citation_count", "provenance_count", "updated_at")
    list_filter = ("visibility", "terms")
    search_fields = ("title", "summary", "slug")
    prepopulated_fields = {"slug": ("title",)}
    filter_horizontal = ("tracks", "people", "collections", "citations", "terms")
    actions = ["mark_public", "mark_pending_review"]

    @admin.display(description="Citations")
    def citation_count(self, obj):
        return obj.citations.count()

    @admin.display(description="Provenance")
    def provenance_count(self, obj):
        return obj.provenance_records.count()

    @admin.action(description="Mark selected records public")
    def mark_public(self, request, queryset):
        queryset.update(visibility="public")

    @admin.action(description="Mark selected records pending review")
    def mark_pending_review(self, request, queryset):
        queryset.update(visibility="pending_review")


@admin.register(Citation)
class CitationAdmin(admin.ModelAdmin):
    list_display = ("title", "source_type", "author", "published_at", "url")
    list_filter = ("source_type",)
    search_fields = ("title", "author", "url", "note")


@admin.register(ProvenanceRecord)
class ProvenanceRecordAdmin(admin.ModelAdmin):
    list_display = ("event_type", "archive_record", "media_asset", "source_name", "created_at")
    list_filter = ("event_type",)
    search_fields = ("event_type", "source_name", "source_identifier", "checksum_sha256", "note")


@admin.register(SourceRating)
class SourceRatingAdmin(admin.ModelAdmin):
    list_display = ("archive_record", "kind", "value", "max_value", "contributor", "created_at")
    list_filter = ("kind", "value")
    search_fields = ("archive_record__title", "rationale", "contributor__username")


@admin.register(VocabularyTerm)
class VocabularyTermAdmin(admin.ModelAdmin):
    list_display = ("vocabulary", "code", "label", "uri")
    list_filter = ("vocabulary",)
    search_fields = ("vocabulary", "code", "label", "description", "uri")
