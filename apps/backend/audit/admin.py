from django.contrib import admin

from .models import AuditLog


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ("action", "actor", "content_type", "object_id", "created_at")
    list_filter = ("action", "content_type")
    search_fields = ("action", "object_id", "actor__username")
    readonly_fields = ("created_at", "updated_at")
