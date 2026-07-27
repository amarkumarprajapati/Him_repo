import uuid

from django.core.validators import MinValueValidator, MaxValueValidator
from django.db import models
from django.utils import timezone


class DeviceInfo(models.Model):
    DEVICE_DF = "DF"
    DEVICE_DRONE = "DRONE"
    DEVICE_SATELLITE = "SATELLITE"
    DEVICE_MONITORING = "MONITORING_SENSOR"
    DEVICE_PASSIVE_CELL = "PASSIVE_CELL"
    DEVICE_ACTIVE_CELL = "ACTIVE_CELL"

    DEVICE_TYPE_CHOICES = [
        (DEVICE_DF, "DF"),
        (DEVICE_DRONE, "Drone"),
        (DEVICE_SATELLITE, "Satellite"),
        (DEVICE_MONITORING, "Monitoring"),
        (DEVICE_PASSIVE_CELL, "Passive Cell"),
        (DEVICE_ACTIVE_CELL, "Active Cell"),
    ]

    HEARTBEAT_ACTIVE = "ACTIVE"
    HEARTBEAT_INACTIVE = "INACTIVE"

    HEARTBEAT_CHOICES = [
        (HEARTBEAT_ACTIVE, "Active"),
        (HEARTBEAT_INACTIVE, "Inactive"),
    ]

    NETWORK_ONLINE = "ONLINE"
    NETWORK_OFFLINE = "OFFLINE"

    NETWORK_CHOICES = [
        (NETWORK_ONLINE, "Online"),
        (NETWORK_OFFLINE, "Offline"),
    ]

    OPERATING_MASTER = "MASTER"
    OPERATING_REMOTE = "REMOTE"

    OPERATING_STATUS_CHOICES = [
        (OPERATING_MASTER, "Master"),
        (OPERATING_REMOTE, "Remote"),
    ]

    QUARD_MUMBAI = 1
    QUARD_PUNE = 2

    QUARD_NAMES = {
        QUARD_MUMBAI: "Mumbai",
        QUARD_PUNE: "Pune",
    }

    REGION_STATIONS = [
        {
            "station_number": 1,
            "station_type": "MONITORING",
            "device_types": [DEVICE_MONITORING],
            "max_devices": 1,
        },
        {
            "station_number": 2,
            "station_type": "DRONE",
            "device_types": [DEVICE_DRONE],
            "max_devices": 1,
        },
        {
            "station_number": 3,
            "station_type": "DF",
            "device_types": [DEVICE_DF],
            "max_devices": 2,
        },
        {
            "station_number": 4,
            "station_type": "SATELLITE_INTERCEPT",
            "device_types": [DEVICE_SATELLITE, DEVICE_ACTIVE_CELL, DEVICE_PASSIVE_CELL],
            "max_devices": 3,
        },
    ]

    device_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, db_index=True)
    device_type = models.CharField(max_length=50, choices=DEVICE_TYPE_CHOICES, default=DEVICE_DF)
    ip_address = models.GenericIPAddressField(null=True, blank=True) 
    port = models.IntegerField(null=True, blank=True, help_text="Device port")
    node_id = models.CharField(max_length=100, null=True, blank=True, default=None)
    node_name = models.CharField(max_length=255, null=True, blank=True, default=None)
    latitude = models.FloatField(null=True, blank=True, help_text="Device latitude")
    longitude = models.FloatField(null=True, blank=True, help_text="Device longitude")
    operating_status = models.CharField(
        max_length=20, choices=OPERATING_STATUS_CHOICES, null=True, blank=True, help_text="MASTER or REMOTE"
    )
    master_device = models.ForeignKey(
        "self", null=True, blank=True, on_delete=models.SET_NULL,
        related_name="sub_nodes", help_text="Master device this node belongs to"
    )
    heartbeat_status = models.CharField(max_length=50, choices=HEARTBEAT_CHOICES, null=True, blank=True)
    network_status = models.CharField(max_length=50, choices=NETWORK_CHOICES, null=True, blank=True)
    telemetry_timestamp = models.DateTimeField(default=timezone.now, db_index=True)
    status = models.CharField(max_length=50, null=True, blank=True, default=None, help_text="Device status e.g. active, inactive")
    station_name = models.CharField(max_length=255, null=True, blank=True, default=None)
    quard_id = models.IntegerField(
        null=True,
        blank=True,
        help_text="Quard number: 1=Mumbai, 2=Pune (add more manually)",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    csvrunning_status = models.IntegerField(
        default=0,
        validators=[MinValueValidator(0), MaxValueValidator(1)],
        help_text="0=offline, 1=CSV generation active"
    )

    class Meta:
        db_table = "device_info"
        ordering = ["-telemetry_timestamp"]
        indexes = [
            models.Index(fields=["device_type", "telemetry_timestamp"]),
            models.Index(fields=["network_status", "telemetry_timestamp"]),
            models.Index(fields=["heartbeat_status", "telemetry_timestamp"]),
        ]

    def __str__(self):
        return f"{self.device_type} {self.node_name or self.node_id} ({self.device_id})"
