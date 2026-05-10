from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import Role, User


@admin.register(User)
class DervaishUserAdmin(UserAdmin):
    fieldsets = UserAdmin.fieldsets + (
        ("Dervaish", {"fields": ("display_name", "role", "trust_score")}),
    )
    list_display = ("username", "email", "display_name", "role", "trust_score", "is_active")
    list_filter = UserAdmin.list_filter + ("role",)


@admin.register(Role)
class RoleAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "updated_at")
    search_fields = ("code", "name", "description")
