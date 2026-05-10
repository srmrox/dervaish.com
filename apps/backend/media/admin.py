from django.contrib import admin

from .models import Caption, Chapter, MediaAsset, MediaDerivative, MediaProcessingJob, MediaRendition, UploadSession


class MediaRenditionInline(admin.TabularInline):
    model = MediaRendition
    extra = 0


class MediaDerivativeInline(admin.TabularInline):
    model = MediaDerivative
    extra = 0


class MediaProcessingJobInline(admin.TabularInline):
    model = MediaProcessingJob
    extra = 0
    readonly_fields = ("created_at", "updated_at", "started_at", "completed_at")


@admin.register(MediaAsset)
class MediaAssetAdmin(admin.ModelAdmin):
    inlines = [MediaRenditionInline, MediaDerivativeInline, MediaProcessingJobInline]
    list_display = ("title", "kind", "status", "mime_type", "size_bytes", "duration_ms", "created_at")
    list_filter = ("kind", "status", "is_master")
    search_fields = ("title", "original_filename", "storage_key", "checksum_sha256")


@admin.register(Caption)
class CaptionAdmin(admin.ModelAdmin):
    list_display = ("label", "language_code", "format", "is_published", "track", "asset")
    list_filter = ("language_code", "format", "is_published")


@admin.register(Chapter)
class ChapterAdmin(admin.ModelAdmin):
    list_display = ("title", "track", "language_code", "start_ms", "end_ms")
    list_filter = ("language_code",)


@admin.register(UploadSession)
class UploadSessionAdmin(admin.ModelAdmin):
    list_display = ("asset", "status", "expected_size_bytes", "expires_at", "completed_at")
    list_filter = ("status",)
    search_fields = ("asset__title", "asset__storage_key", "expected_checksum_sha256")


@admin.register(MediaProcessingJob)
class MediaProcessingJobAdmin(admin.ModelAdmin):
    list_display = ("asset", "kind", "status", "attempts", "started_at", "completed_at")
    list_filter = ("kind", "status")
    search_fields = ("asset__title", "asset__storage_key", "celery_task_id", "error")


@admin.register(MediaDerivative)
class MediaDerivativeAdmin(admin.ModelAdmin):
    list_display = ("asset", "kind", "format", "status", "created_at")
    list_filter = ("kind", "format", "status")
