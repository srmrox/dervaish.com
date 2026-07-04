from django.contrib import admin

from .models import Caption, MediaAsset, MediaRendition


class MediaRenditionInline(admin.TabularInline):
    model = MediaRendition
    extra = 0


class CaptionInline(admin.TabularInline):
    model = Caption
    extra = 0


@admin.register(MediaAsset)
class MediaAssetAdmin(admin.ModelAdmin):
    list_display = ("id", "kind", "processing_status", "processing_attempts", "duration_ms", "mime_type")
    list_filter = ("kind", "processing_status")
    search_fields = ("storage_key", "source_url", "original_filename")
    readonly_fields = ("processing_status", "processing_error", "processing_log", "processing_attempts")
    inlines = [MediaRenditionInline, CaptionInline]


@admin.register(MediaRendition)
class MediaRenditionAdmin(admin.ModelAdmin):
    list_display = ("id", "asset", "container", "bitrate_kbps", "is_streaming", "is_offline_download")
    list_filter = ("container", "is_streaming", "is_offline_download")
