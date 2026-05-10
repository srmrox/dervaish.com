from django.contrib import admin

from .models import Collection, Person, Queue, QueueItem, Track, TrackCredit, TrackVote


class TrackCreditInline(admin.TabularInline):
    model = TrackCredit
    extra = 0


@admin.register(Track)
class TrackAdmin(admin.ModelAdmin):
    inlines = [TrackCreditInline]
    list_display = ("title", "visibility", "primary_language_code", "duration_ms", "published_at")
    list_filter = ("visibility", "primary_language_code")
    search_fields = ("title", "slug")
    prepopulated_fields = {"slug": ("title",)}


@admin.register(Person)
class PersonAdmin(admin.ModelAdmin):
    list_display = ("name", "primary_role", "visibility", "origin")
    list_filter = ("primary_role", "visibility")
    search_fields = ("name", "aliases")
    prepopulated_fields = {"slug": ("name",)}


@admin.register(Collection)
class CollectionAdmin(admin.ModelAdmin):
    list_display = ("title", "visibility", "is_curated", "owner")
    list_filter = ("visibility", "is_curated")
    search_fields = ("title", "slug")
    prepopulated_fields = {"slug": ("title",)}


admin.site.register(Queue)
admin.site.register(QueueItem)
admin.site.register(TrackVote)
