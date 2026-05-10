from django.contrib import admin

from .models import LyricLanguage, LyricSegment, LyricSet


class LyricLanguageInline(admin.TabularInline):
    model = LyricLanguage
    extra = 0


class LyricSegmentInline(admin.TabularInline):
    model = LyricSegment
    extra = 0


@admin.register(LyricSet)
class LyricSetAdmin(admin.ModelAdmin):
    inlines = [LyricLanguageInline, LyricSegmentInline]
    list_display = ("title", "track", "status", "version", "is_canonical")
    list_filter = ("status", "is_canonical", "source")


admin.site.register(LyricLanguage)
admin.site.register(LyricSegment)
