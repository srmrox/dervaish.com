from django.contrib import admin

from .models import ArchiveRecord, Citation, ProvenanceRecord, SourceRating


class ProvenanceInline(admin.TabularInline):
    model = ProvenanceRecord
    extra = 0


class SourceRatingInline(admin.TabularInline):
    model = SourceRating
    extra = 0


@admin.register(ArchiveRecord)
class ArchiveRecordAdmin(admin.ModelAdmin):
    list_display = ("title", "kalam", "visibility", "state")
    list_filter = ("visibility", "state")
    search_fields = ("title", "summary")
    prepopulated_fields = {"slug": ("title",)}
    inlines = [ProvenanceInline, SourceRatingInline]


@admin.register(Citation)
class CitationAdmin(admin.ModelAdmin):
    list_display = ("title", "source_type", "author")
    list_filter = ("source_type",)
    search_fields = ("title", "author")
