from django.db import models
from django.utils import timezone


class EventLog(models.Model):
    SEVERITY_CRITICAL = "CRITICAL"
    SEVERITY_HIGH = "HIGH"
    SEVERITY_MEDIUM = "MEDIUM"
    SEVERITY_LOW = "LOW"
    SEVERITY_INFORMATIONAL = "INFORMATIONAL"

    SEVERITY_CHOICES = [
        (SEVERITY_CRITICAL, "Critical"),
        (SEVERITY_HIGH, "High"),
        (SEVERITY_MEDIUM, "Medium"),
        (SEVERITY_LOW, "Low"),
        (SEVERITY_INFORMATIONAL, "Informational"),
    ]

    SEVERITY_COLOR = {
        SEVERITY_CRITICAL: "RED",
        SEVERITY_HIGH: "ORANGE",
        SEVERITY_MEDIUM: "YELLOW",
        SEVERITY_LOW: "BLUE",
        SEVERITY_INFORMATIONAL: "GREEN",
    }

    SUBSYSTEM_CHOICES = [
        ("DF", "Direction Finding"),
        ("MONITORING", "Monitoring"),
        ("DRONE", "Drone Detection"),
        ("SATELLITE", "Satellite"),
        ("PASSIVE_CELLULAR", "Passive Cellular"),
        ("ACTIVE_CELLULAR", "Active Cellular"),
        ("SYSTEM", "System"),
    ]

    EVENT_TYPE_CHOICES = [
        ("RF_THREAT", "RF Threat"),
        ("DRONE_THREAT", "Drone Threat"),
        ("COMMUNICATION_LOSS", "Communication Loss"),
        ("SYNC_FAILURE", "Synchronization Failure"),
        ("FREQUENCY_VIOLATION", "Frequency Violation"),
        ("FORBIDDEN_SECTOR", "Forbidden Sector Alert"),
        ("NODE_FAILURE", "Node Failure"),
        ("CALIBRATION_FAILURE", "Calibration Failure"),
        ("INFO", "Informational"),
    ]

    id = models.BigAutoField(primary_key=True)
    session_id = models.UUIDField(null=True, blank=True, db_index=True)
    subsystem_type = models.CharField(max_length=100, choices=SUBSYSTEM_CHOICES, default="SYSTEM", db_index=True)
    severity = models.CharField(max_length=50, choices=SEVERITY_CHOICES, default=SEVERITY_LOW, db_index=True)
    event_type = models.CharField(max_length=100, choices=EVENT_TYPE_CHOICES, default="INFO")
    device_reference_id = models.CharField(max_length=100, blank=True, default="", db_index=True)
    message = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = "event_log"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["severity", "created_at"]),
            models.Index(fields=["subsystem_type", "created_at"]),
        ]

    def __str__(self):
        return f"[{self.severity}] {self.event_type} ({self.subsystem_type})"

    @property
    def severity_color(self):
        return self.SEVERITY_COLOR.get(self.severity, "GRAY")
