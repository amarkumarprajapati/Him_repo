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
    csvrunning_status = serializers.IntegerField()
    url = serializers.SerializerMethodField()
 
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
