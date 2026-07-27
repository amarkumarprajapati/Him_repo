from django.contrib import admin

from .models import (
    SyncStatus,
    TelemetrySession,
)


@admin.register(TelemetrySession)
class TelemetrySessionAdmin(admin.ModelAdmin):
    list_display = (
        "session_id",
        "session_name",
        "cyronics_ip",
        "status",
        "start_time",
        "last_sync_time",
    )
    list_filter = ("status",)
    search_fields = ("session_id", "session_name", "cyronics_ip")
    readonly_fields = ("session_id", "start_time", "stop_time", "last_sync_time", "created_at", "updated_at")
    ordering = ("-created_at",)


@admin.register(SyncStatus)
class SyncStatusAdmin(admin.ModelAdmin):
    list_display = ("session", "sync_status", "last_sync_timestamp", "exported_records")
    list_filter = ("sync_status",)
    search_fields = ("session__session_id", "csv_file_name")
    readonly_fields = ("last_sync_timestamp",)
    ordering = ("-last_sync_timestamp",)
