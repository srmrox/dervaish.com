from django.contrib import admin

from .models import LyricLanguage, LyricSegment, LyricSet, UserLyricPreference


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


@admin.register(UserLyricPreference)
class UserLyricPreferenceAdmin(admin.ModelAdmin):
    list_display = ("user", "track", "visible_language_ids", "updated_at")
    search_fields = ("user__username", "track__title")
