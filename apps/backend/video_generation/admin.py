from django.contrib import admin

from .models import VideoGenerationJob


@admin.register(VideoGenerationJob)
class VideoGenerationJobAdmin(admin.ModelAdmin):
    list_display = ("title", "status", "source_mode", "resolution", "requested_by", "published_at", "created_at")
    list_filter = ("status", "source_mode", "resolution")
    search_fields = ("title", "voice", "writer", "celery_task_id", "failure_reason")
    readonly_fields = ("render_payload", "log", "failure_reason", "celery_task_id", "cancelled_at", "published_at", "created_at", "updated_at")
    actions = ["mark_cancelled"]

    @admin.action(description="Cancel selected queued/running jobs")
    def mark_cancelled(self, request, queryset):
        from django.utils import timezone

        queryset.exclude(status="completed").update(status="cancelled", cancelled_at=timezone.now())
