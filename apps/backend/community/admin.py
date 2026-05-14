from django.contrib import admin

from .models import CorrectionDraft, Submission, TrackRequest, TrackRequestVote, VerificationVote


class CorrectionDraftInline(admin.TabularInline):
    model = CorrectionDraft
    extra = 0
    fields = ("target_track", "target_archive_record", "fields", "status", "updated_at")
    readonly_fields = ("updated_at",)


class VerificationVoteInline(admin.TabularInline):
    model = VerificationVote
    extra = 0
    fields = ("field", "vote", "voter", "note", "updated_at")
    readonly_fields = ("updated_at",)


@admin.register(Submission)
class SubmissionAdmin(admin.ModelAdmin):
    inlines = [CorrectionDraftInline, VerificationVoteInline]
    list_display = ("title", "submitter", "status", "verification_count", "reviewed_by", "created_at")
    list_filter = ("status",)
    search_fields = ("title", "voice", "writer", "source_name")
    filter_horizontal = ("citations", "media_assets")
    actions = ["mark_under_review", "mark_approved", "mark_rejected"]

    @admin.display(description="Verifications")
    def verification_count(self, obj):
        return obj.verification_votes.count()

    @admin.action(description="Mark selected submissions under review")
    def mark_under_review(self, request, queryset):
        queryset.update(status="under_review")

    @admin.action(description="Approve selected submissions")
    def mark_approved(self, request, queryset):
        queryset.update(status="approved")

    @admin.action(description="Reject selected submissions")
    def mark_rejected(self, request, queryset):
        queryset.update(status="rejected")


@admin.register(CorrectionDraft)
class CorrectionDraftAdmin(admin.ModelAdmin):
    list_display = ("submission", "target_track", "target_archive_record", "status", "updated_at")
    list_filter = ("status",)
    search_fields = ("submission__title", "target_track__title", "target_archive_record__title")


@admin.register(VerificationVote)
class VerificationVoteAdmin(admin.ModelAdmin):
    list_display = ("submission", "field", "vote", "voter", "updated_at")
    list_filter = ("field", "vote")
    search_fields = ("submission__title", "voter__username", "note")


@admin.register(TrackRequest)
class TrackRequestAdmin(admin.ModelAdmin):
    list_display = ("title", "target_track", "requester", "status", "upvote_count", "updated_at")
    list_filter = ("status",)
    search_fields = ("title", "reciter_name", "writer_name", "source_hint", "requester__username")
    actions = ["mark_planned", "mark_fulfilled"]

    @admin.display(description="Upvotes")
    def upvote_count(self, obj):
        return obj.votes.count()

    @admin.action(description="Mark selected requests planned")
    def mark_planned(self, request, queryset):
        queryset.update(status="planned")

    @admin.action(description="Mark selected requests fulfilled")
    def mark_fulfilled(self, request, queryset):
        queryset.update(status="fulfilled")


@admin.register(TrackRequestVote)
class TrackRequestVoteAdmin(admin.ModelAdmin):
    list_display = ("request", "user", "created_at")
    search_fields = ("request__title", "user__username")
