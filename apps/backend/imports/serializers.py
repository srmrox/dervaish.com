from rest_framework import serializers

from .models import ImportBatch


class ImportBatchSerializer(serializers.ModelSerializer):
    class Meta:
        model = ImportBatch
        fields = ["id", "source", "status", "dry_run", "source_label", "payload", "summary", "error", "created_by", "created_at", "updated_at"]
        read_only_fields = ["id", "status", "summary", "error", "created_by", "created_at", "updated_at"]
