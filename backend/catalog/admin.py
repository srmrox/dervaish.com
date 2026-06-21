from django.contrib import admin

from .models import (
    Collection,
    CollectionItem,
    Credit,
    Kalam,
    Person,
    Rendition,
    Verse,
)


class VerseInline(admin.TabularInline):
    model = Verse
    extra = 0


class CreditInline(admin.TabularInline):
    model = Credit
    extra = 0
    fk_name = "kalam"


class RenditionCreditInline(admin.TabularInline):
    model = Credit
    extra = 0
    fk_name = "rendition"


@admin.register(Person)
class PersonAdmin(admin.ModelAdmin):
    list_display = ("name", "era", "region", "visibility", "state")
    list_filter = ("visibility", "state", "tradition")
    search_fields = ("name", "name_native", "aliases")
    prepopulated_fields = {"slug": ("name",)}


@admin.register(Kalam)
class KalamAdmin(admin.ModelAdmin):
    list_display = ("title", "author", "genre", "primary_language", "visibility", "state")
    list_filter = ("visibility", "state", "genre", "tradition")
    search_fields = ("title", "title_native", "title_transliterated")
    prepopulated_fields = {"slug": ("title",)}
    autocomplete_fields = ("author",)
    inlines = [VerseInline, CreditInline]


@admin.register(Rendition)
class RenditionAdmin(admin.ModelAdmin):
    list_display = ("__str__", "kalam", "year", "protection_level", "visibility", "state")
    list_filter = ("visibility", "state", "protection_level", "year")
    search_fields = ("title", "album", "publisher")
    prepopulated_fields = {"slug": ("title",)}
    autocomplete_fields = ("kalam",)
    filter_horizontal = ("media_assets",)
    inlines = [RenditionCreditInline]


@admin.register(Collection)
class CollectionAdmin(admin.ModelAdmin):
    list_display = ("title", "is_curated", "owner", "visibility")
    list_filter = ("is_curated", "visibility")
    search_fields = ("title",)
    prepopulated_fields = {"slug": ("title",)}


admin.site.register(CollectionItem)
admin.site.register(Verse)
