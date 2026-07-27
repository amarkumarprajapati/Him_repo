import uuid

from django.db import models
from django.utils import timezone


class Notification(models.Model):
    CATEGORY_SESSION = "SESSION"
    CATEGORY_SYSTEM = "SYSTEM"
    CATEGORY_EXPORT = "EXPORT"
    CATEGORY_ALERT = "ALERT"

    CATEGORY_CHOICES = [
        (CATEGORY_SESSION, "Session"),
        (CATEGORY_SYSTEM, "System"),
        (CATEGORY_EXPORT, "Export"),
        (CATEGORY_ALERT, "Alert"),
    ]

    PRIORITY_LOW = "LOW"
    PRIORITY_MEDIUM = "MEDIUM"
    PRIORITY_HIGH = "HIGH"
    PRIORITY_CRITICAL = "CRITICAL"

    PRIORITY_CHOICES = [
        (PRIORITY_LOW, "Low"),
        (PRIORITY_MEDIUM, "Medium"),
        (PRIORITY_HIGH, "High"),
        (PRIORITY_CRITICAL, "Critical"),
    ]

    STATUS_UNREAD = "UNREAD"
    STATUS_READ = "READ"

    STATUS_CHOICES = [
        (STATUS_UNREAD, "Unread"),
        (STATUS_READ, "Read"),
    ]

    id = models.BigAutoField(primary_key=True)
    notification_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False, db_index=True)
    title = models.CharField(max_length=255)
    message = models.TextField(blank=True, default="")
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES, default=CATEGORY_SESSION)
    priority = models.CharField(max_length=10, choices=PRIORITY_CHOICES, default=PRIORITY_LOW)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default=STATUS_UNREAD)
    session_id = models.UUIDField(null=True, blank=True)
    session_name = models.CharField(max_length=255, blank=True, default="")
    action_type = models.CharField(max_length=100, blank=True, default="")
    triggered_by = models.CharField(max_length=150, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    read_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "notifications"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["category", "status", "created_at"]),
            models.Index(fields=["priority", "created_at"]),
            models.Index(fields=["triggered_by", "created_at"]),
        ]

    def __str__(self):
        return f"[{self.category}] {self.title}"

    def mark_as_read(self):
        self.status = self.STATUS_READ
        self.read_at = timezone.now()
        self.save(update_fields=["status", "read_at"])
