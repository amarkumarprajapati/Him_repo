from django.contrib import admin

from .models import DeviceInfo


@admin.register(DeviceInfo)
class DeviceInfoAdmin(admin.ModelAdmin):
    list_display = (
        "device_id",
        "device_type",
        "node_id",
        "node_name",
        "ip_address",
        "heartbeat_status",
        "network_status",
        "quard_id",
        "telemetry_timestamp",
    )
    list_filter = ("device_type", "quard_id", "heartbeat_status", "network_status", "telemetry_timestamp")
    search_fields = ("device_id", "node_id", "node_name", "ip_address")
    readonly_fields = ("device_id", "created_at")
    ordering = ("-telemetry_timestamp",)
