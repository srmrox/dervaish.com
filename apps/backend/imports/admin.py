from django.contrib import admin

from .models import ImportBatch


@admin.register(ImportBatch)
class ImportBatchAdmin(admin.ModelAdmin):
    list_display = ("id", "source", "status", "dry_run", "source_label", "created_by", "created_at")
    list_filter = ("source", "status", "dry_run")
    search_fields = ("source_label", "error")
    readonly_fields = ("summary", "error", "created_at", "updated_at")
