from django.contrib import admin

from .models import VideoGenerationJob


@admin.register(VideoGenerationJob)
class VideoGenerationJobAdmin(admin.ModelAdmin):
    list_display = ("title", "status", "source_mode", "resolution", "requested_by", "created_at")
    list_filter = ("status", "source_mode", "resolution")
    search_fields = ("title", "voice", "writer")
