from django.conf import settings
from django.utils import timezone
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from telemetry.models import TelemetrySession


class TelemetrySessionSerializer(serializers.ModelSerializer):
    start_time = serializers.SerializerMethodField()
    stop_time = serializers.SerializerMethodField()
    last_sync_time = serializers.SerializerMethodField()

    class Meta:
        model = TelemetrySession
        fields = [
            "session_id",
            "session_name",
            "drone_detector_ip",
            "cellular_active_ip",
            "cellular_passive_ip",
            "satellite_interception_ip",
            "session_type",
            "node_id",
            "node_lat",
            "node_long",
            "remarks",
            "export_status",
            "polling_interval",
            "status",
            "start_time",
            "stop_time",
            "stop_reason",
            "last_sync_time",
            "created_by",
        ]
        read_only_fields = ["session_id"]

    @extend_schema_field(serializers.CharField(allow_null=True))
    def get_start_time(self, obj):
        if obj.start_time:
            return timezone.localtime(obj.start_time).strftime(settings.DATETIME_DISPLAY_FORMAT)
        return None

    @extend_schema_field(serializers.CharField(allow_null=True))
    def get_stop_time(self, obj):
        if obj.stop_time:
            return timezone.localtime(obj.stop_time).strftime(settings.DATETIME_DISPLAY_FORMAT)
        return None

    @extend_schema_field(serializers.CharField(allow_null=True))
    def get_last_sync_time(self, obj):
        if obj.last_sync_time:
            return timezone.localtime(obj.last_sync_time).strftime(settings.DATETIME_DISPLAY_FORMAT)
        return None


class CreateSessionSerializer(serializers.Serializer):
    session_name = serializers.CharField(max_length=255, required=False, allow_blank=True, default="test_lf")
    operation_mode = serializers.CharField(max_length=50, required=False, allow_blank=True, default="LF")
    session_type = serializers.CharField(max_length=50, required=False, allow_blank=True, default="Manual")
    cyronics_ip = serializers.IPAddressField(required=False, allow_null=True)
    cognizant_ip = serializers.IPAddressField(required=False, allow_null=True)
    monitoring_system_ip = serializers.IPAddressField(required=False, allow_null=True)
    df_system_ip = serializers.IPAddressField(required=False, allow_null=True)
    drone_detector_ip = serializers.IPAddressField(required=False, allow_null=True)
    cellular_active_ip = serializers.IPAddressField(required=False, allow_null=True)
    cellular_passive_ip = serializers.IPAddressField(required=False, allow_null=True)
    satellite_interception_ip = serializers.IPAddressField(required=False, allow_null=True)
    node_id = serializers.CharField(max_length=100, required=False, allow_blank=True, default="")
    node_lat = serializers.FloatField(required=False, allow_null=True)
    node_long = serializers.FloatField(required=False, allow_null=True)
    polling_interval = serializers.IntegerField(default=10)
    remarks = serializers.CharField(required=False, allow_blank=True, default="")
    created_by = serializers.CharField(max_length=150, required=False, allow_blank=True, default="")


class CreateSessionDocsRequestSerializer(serializers.Serializer):
    session_name = serializers.CharField(max_length=255)
    operation_mode = serializers.CharField(max_length=50)
    node_id = serializers.CharField(max_length=100)
    node_lat = serializers.FloatField()
    node_long = serializers.FloatField()


class StopSessionSerializer(serializers.Serializer):
    session_id = serializers.UUIDField()
    stop_reason = serializers.CharField(max_length=255, required=False, allow_blank=True, default="")


class SessionDetailResponseSerializer(serializers.Serializer):
    status = serializers.CharField(default="SUCCESS")
    message = serializers.CharField()
    data = TelemetrySessionSerializer(required=False)


class SessionListResponseSerializer(serializers.Serializer):
    status = serializers.CharField(default="SUCCESS")
    count = serializers.IntegerField()
    total_pages = serializers.IntegerField()
    current_page = serializers.IntegerField()
    results = TelemetrySessionSerializer(many=True)
