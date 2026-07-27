from django.contrib import admin

from .models import Notification


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = (
        "title",
        "category",
        "priority",
        "status",
        "session_name",
        "action_type",
        "triggered_by",
        "created_at",
    )
    list_filter = ("category", "priority", "status", "created_at")
    search_fields = ("title", "message", "session_name", "action_type", "triggered_by")
    readonly_fields = ("notification_id", "created_at", "read_at")
    ordering = ("-created_at",)
