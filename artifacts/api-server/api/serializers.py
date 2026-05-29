from rest_framework import serializers
from .models import Client, IngestionBatch, EmissionsRecord, AuditLog


class ClientSerializer(serializers.ModelSerializer):
    class Meta:
        model = Client
        fields = ["id", "name", "slug", "created_at"]


class IngestionBatchSerializer(serializers.ModelSerializer):
    client_id = serializers.IntegerField(source="client.id", read_only=True)

    class Meta:
        model = IngestionBatch
        fields = [
            "id", "client_id", "source_type", "status",
            "filename", "row_count", "error_count", "error_details",
            "created_at", "completed_at",
        ]


class EmissionsRecordSerializer(serializers.ModelSerializer):
    batch_id = serializers.IntegerField(source="batch.id", read_only=True)
    client_id = serializers.IntegerField(source="client.id", read_only=True)
    activity_date = serializers.DateField(format="%Y-%m-%d")

    class Meta:
        model = EmissionsRecord
        fields = [
            "id", "batch_id", "client_id", "scope", "category", "source_type",
            "raw_data", "activity_amount", "activity_unit",
            "normalized_co2e_kg",
            "activity_date", "location", "description",
            "status", "review_notes", "reviewed_by", "reviewed_at",
            "is_suspicious", "suspicious_reason", "created_at",
        ]


class AuditLogSerializer(serializers.ModelSerializer):
    record_id = serializers.IntegerField(source="record.id", read_only=True)

    class Meta:
        model = AuditLog
        fields = ["id", "record_id", "action", "actor", "before_state", "after_state", "created_at"]
