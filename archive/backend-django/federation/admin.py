from django.contrib import admin

from .models import ContentSource, MediaAssetMirror, MediaMirror


@admin.register(ContentSource)
class ContentSourceAdmin(admin.ModelAdmin):
    list_display = ("name", "kind", "is_official", "is_default", "is_enabled", "verified", "priority")
    list_filter = ("kind", "is_official", "is_default", "is_enabled", "verified")
    search_fields = ("name", "base_url")
    prepopulated_fields = {"slug": ("name",)}


class MediaAssetMirrorInline(admin.TabularInline):
    model = MediaAssetMirror
    extra = 0


@admin.register(MediaMirror)
class MediaMirrorAdmin(admin.ModelAdmin):
    list_display = ("name", "kind", "is_official", "is_active", "is_default_enabled", "carries_all", "priority")
    list_filter = ("kind", "is_official", "is_active", "is_default_enabled", "carries_all", "verified")
    search_fields = ("name", "base_url")
    prepopulated_fields = {"slug": ("name",)}
    inlines = [MediaAssetMirrorInline]


@admin.register(MediaAssetMirror)
class MediaAssetMirrorAdmin(admin.ModelAdmin):
    list_display = ("asset", "mirror", "available", "checksum_ok", "last_checked")
    list_filter = ("available", "mirror")
