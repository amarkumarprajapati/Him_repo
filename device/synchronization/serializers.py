from rest_framework import serializers

from telemetry.models import SyncStatus


class SyncStatusDetailSerializer(serializers.ModelSerializer):
    session_id = serializers.UUIDField(source="session.session_id", read_only=True)

    class Meta:
        model = SyncStatus
        fields = [
            "id",
            "session_id",
            "subsystem_type",
            "device_reference_id",
            "node_id",
            "sync_status",
            "retry_count",
            "polling_interval",
            "last_sync_timestamp",
            "last_retry_timestamp",
            "last_failure_timestamp",
            "last_error_message",
            "exported_records",
            "csv_file_name",
            "destination_ip",
            "transfer_status",
            "remarks",
            "created_at",
            "updated_at",
        ]


class SyncStartSerializer(serializers.Serializer):
    session_id = serializers.UUIDField()
    subsystem_type = serializers.ChoiceField(
        choices=[choice[0] for choice in SyncStatus.SUBSYSTEM_CHOICES],
        required=False,
        allow_blank=True,
    )
    device_reference_id = serializers.CharField(required=False, allow_blank=True, default="")
    polling_interval = serializers.IntegerField(required=False, default=10)
    destination_ip = serializers.IPAddressField(required=False, allow_null=True)


class SyncExportSerializer(serializers.Serializer):
    session_id = serializers.UUIDField()
    module = serializers.CharField(max_length=50)
    selected_fields = serializers.ListField(
        child=serializers.CharField(max_length=100),
        required=False,
        allow_empty=True,
        default=list,
    )
    destination_ip = serializers.IPAddressField(required=False, allow_null=True)
