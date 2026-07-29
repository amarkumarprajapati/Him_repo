import re

from rest_framework import serializers
 
from .models import DeviceInfo
 
 
EMO_UI_BASE_URL = "https://india-demo.nexyte.local"
 
DEVICE_URL_PATH_MAP = {
    "DF": "/DF/receiver_config_new",
    "DRONE": "/drone-detection",
    "MONITORING_SENSOR": "/config-setting",
    DeviceInfo.DEVICE_SATELLITE: "/",
    DeviceInfo.DEVICE_PASSIVE_CELL: "/",
    DeviceInfo.DEVICE_ACTIVE_CELL: "/",
}
 
 
class DeviceInfoSerializer(serializers.ModelSerializer):
    csvrunning_status = serializers.IntegerField(required=False, default=0)
    quard_id = serializers.IntegerField(required=False, default=0, allow_null=True)
    url = serializers.SerializerMethodField()

    BASE_REQUIRED_FIELDS = (
        "device_type",
        "ip_address",
        "port",
        "latitude",
        "longitude",
    )
    NODE_DETAIL_REQUIRED_TYPES = {
        DeviceInfo.DEVICE_PASSIVE_CELL,
        DeviceInfo.DEVICE_ACTIVE_CELL,
        DeviceInfo.DEVICE_SATELLITE,
    }
    NODE_ID_PATTERN = r"^(?=.*[A-Za-z])(?=.*\d)[A-Za-z0-9_-]+$"
 
    class Meta:
        model = DeviceInfo
        fields = [
            "device_id",
            "device_type",
            "ip_address",
            "port",
            "node_id",
            "node_name",
            "latitude",
            "longitude",
            "operating_status",
            "master_device",
            "heartbeat_status",
            "network_status",
            "status",
            "csvrunning_status",
            "station_name",
            "quard_id",
            "telemetry_timestamp",
            "created_at",
            "updated_at",
            "url",
        ]
        read_only_fields = ["device_id", "created_at", "updated_at"]

    def validate(self, attrs):
        attrs = super().validate(attrs)

        if self.instance is not None and self.partial:
            self._validate_partial_values(attrs)
            return attrs

        if attrs.get("csvrunning_status") is None:
            attrs["csvrunning_status"] = 0
        if attrs.get("quard_id") is None:
            attrs["quard_id"] = 0

        device_type = attrs.get("device_type")
        if device_type not in {choice[0] for choice in DeviceInfo.DEVICE_TYPE_CHOICES}:
            raise serializers.ValidationError({"device_type": "Select a valid device type."})

        errors = {}
        for field in self.BASE_REQUIRED_FIELDS:
            if attrs.get(field) in (None, ""):
                errors[field] = "This field is required."

        self._collect_numeric_errors(attrs, errors)

        if device_type in self.NODE_DETAIL_REQUIRED_TYPES:
            for field in ("node_id", "node_name", "station_name"):
                if attrs.get(field) in (None, ""):
                    errors[field] = "This field is required for this device type."
        else:
            attrs["node_id"] = None
            attrs["node_name"] = None
            attrs["station_name"] = None

        node_id = attrs.get("node_id")
        if node_id and not re.fullmatch(self.NODE_ID_PATTERN, node_id):
            errors["node_id"] = "Node ID must contain letters and numbers."

        if errors:
            raise serializers.ValidationError(errors)

        return attrs

    def _validate_partial_values(self, attrs):
        errors = {}
        device_type = attrs.get("device_type", self.instance.device_type)
        node_id = attrs.get("node_id")

        if device_type in self.NODE_DETAIL_REQUIRED_TYPES:
            required_fields = ("node_id", "node_name", "station_name")
            should_validate_final_values = "device_type" in attrs
            for field in required_fields:
                if field in attrs and attrs[field] in (None, ""):
                    errors[field] = "This field is required for this device type."
                elif should_validate_final_values:
                    value = attrs.get(field, getattr(self.instance, field, None))
                    if value in (None, ""):
                        errors[field] = "This field is required for this device type."

        self._collect_numeric_errors(attrs, errors)

        if node_id and not re.fullmatch(self.NODE_ID_PATTERN, node_id):
            errors["node_id"] = "Node ID must contain letters and numbers."

        if "csvrunning_status" in attrs and attrs["csvrunning_status"] is None:
            attrs["csvrunning_status"] = 0
        if "quard_id" in attrs and attrs["quard_id"] is None:
            attrs["quard_id"] = 0

        if errors:
            raise serializers.ValidationError(errors)

    def _collect_numeric_errors(self, attrs, errors):
        port = attrs.get("port")
        latitude = attrs.get("latitude")
        longitude = attrs.get("longitude")
        csvrunning_status = attrs.get("csvrunning_status")

        if port is not None and not 1 <= port <= 65535:
            errors["port"] = "Port must be between 1 and 65535."
        if latitude is not None and not -90 <= latitude <= 90:
            errors["latitude"] = "Latitude must be between -90 and 90."
        if longitude is not None and not -180 <= longitude <= 180:
            errors["longitude"] = "Longitude must be between -180 and 180."
        if csvrunning_status is not None and csvrunning_status not in (0, 1):
            errors["csvrunning_status"] = "CSV running status must be 0 or 1."
 
    def get_url(self, obj):
        path = DEVICE_URL_PATH_MAP.get(obj.device_type)
        if path is None:
            return None
        if obj.device_type in (
            DeviceInfo.DEVICE_SATELLITE,
            DeviceInfo.DEVICE_PASSIVE_CELL,
            DeviceInfo.DEVICE_ACTIVE_CELL,
        ):
            return f"{EMO_UI_BASE_URL}{path}"
        if not obj.ip_address or not obj.port:
            return None
        return f"http://{obj.ip_address}:{obj.port}{path}"


class RegionSerializer(serializers.Serializer):
    quard_id = serializers.IntegerField()
    device_count = serializers.IntegerField()
    devices = DeviceInfoSerializer(many=True)
