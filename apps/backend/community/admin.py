from django.contrib import admin

from .models import CorrectionDraft, Submission, TrackRequest, TrackRequestVote, VerificationVote


@admin.register(Submission)
class SubmissionAdmin(admin.ModelAdmin):
    list_display = ("title", "submitter", "status", "reviewed_by", "created_at")
    list_filter = ("status",)
    search_fields = ("title", "voice", "writer", "source_name")
    filter_horizontal = ("citations", "media_assets")


admin.site.register(CorrectionDraft)
admin.site.register(VerificationVote)
admin.site.register(TrackRequest)
admin.site.register(TrackRequestVote)
