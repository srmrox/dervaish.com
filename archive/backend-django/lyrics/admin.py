from django.contrib import admin

from .models import RenditionVerseTiming


@admin.register(RenditionVerseTiming)
class RenditionVerseTimingAdmin(admin.ModelAdmin):
    list_display = ("rendition", "verse", "start_ms", "end_ms")
    search_fields = ("rendition__slug",)
