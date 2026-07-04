from django.contrib import admin

from .models import VocabularyTerm


@admin.register(VocabularyTerm)
class VocabularyTermAdmin(admin.ModelAdmin):
    list_display = ("label", "kind", "code", "parent")
    list_filter = ("kind",)
    search_fields = ("label", "label_native", "code")
    prepopulated_fields = {"code": ("label",)}
