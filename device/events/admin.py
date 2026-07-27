from django.contrib import admin

from .models import EventLog


@admin.register(EventLog)
class EventLogAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "severity",
        "subsystem_type",
        "event_type",
        "device_reference_id",
        "created_at",
    )
    list_filter = ("severity", "subsystem_type", "event_type")
    search_fields = ("message", "device_reference_id", "session_id")
    readonly_fields = ("created_at",)
    ordering = ("-created_at",)
