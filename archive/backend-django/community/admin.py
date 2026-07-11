from django.contrib import admin

from .models import KalamRequest, RequestUpvote, Submission


@admin.register(Submission)
class SubmissionAdmin(admin.ModelAdmin):
    list_display = ("title", "author", "status", "created_at")
    list_filter = ("status",)
    search_fields = ("title",)


@admin.register(KalamRequest)
class KalamRequestAdmin(admin.ModelAdmin):
    list_display = ("title", "requested_by", "status", "created_at")
    list_filter = ("status",)
    search_fields = ("title", "author_hint", "reciter_hint")


admin.site.register(RequestUpvote)
