import uuid

from django.db import models
from django.utils import timezone


class TelemetrySession(models.Model):
    STATUS_ACTIVE = "ACTIVE"
    STATUS_STOPPED = "STOPPED"
    STATUS_CREATED = "CREATED"
    STATUS_RUNNING = "RUNNING"
    STATUS_STOPPED = "STOPPED"

    STATUS_CHOICES = [
        (STATUS_CREATED, "Created"),
        (STATUS_RUNNING, "Running"),
        (STATUS_STOPPED, "Stopped"),
    ]

    id = models.BigAutoField(primary_key=True)
    session_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False, db_index=True)
    session_name = models.CharField(max_length=255)
    operation_mode = models.CharField(max_length=50, blank=True, default="")
    cyronics_ip = models.GenericIPAddressField(null=True, blank=True)
    cognizant_ip = models.GenericIPAddressField(null=True, blank=True)
    monitoring_system_ip = models.GenericIPAddressField(null=True, blank=True)
    df_system_ip = models.GenericIPAddressField(null=True, blank=True)
    drone_detector_ip = models.GenericIPAddressField(null=True, blank=True)
    cellular_active_ip = models.GenericIPAddressField(null=True, blank=True)
    cellular_passive_ip = models.GenericIPAddressField(null=True, blank=True)
    satellite_interception_ip = models.GenericIPAddressField(null=True, blank=True)
    session_type = models.CharField(max_length=50, blank=True, default="Manual")
    node_id = models.CharField(max_length=100, blank=True, default="")
    node_lat = models.FloatField(null=True, blank=True)
    node_long = models.FloatField(null=True, blank=True)
    remarks = models.TextField(blank=True, default="")
    export_status = models.CharField(max_length=50, blank=True, default="PENDING", db_index=True)
    polling_interval = models.IntegerField(default=10, help_text="Polling interval in seconds")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_CREATED, db_index=True)
    start_time = models.DateTimeField(auto_now_add=True)
    stop_time = models.DateTimeField(null=True, blank=True)
    stop_reason = models.CharField(max_length=255, blank=True, default="")
    last_sync_time = models.DateTimeField(null=True, blank=True)
    created_by = models.CharField(max_length=150, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "telemetry_session"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status", "created_at"]),
            models.Index(fields=["session_id", "status"]),
        ]

    def __str__(self):
        return f"{self.session_name} ({self.session_id})"

    @property
    def is_active(self):
        return self.status != self.STATUS_STOPPED

    def stop(self, reason=""):
        now = timezone.now()
        self.status = self.STATUS_STOPPED
        self.stop_time = now
        self.last_sync_time = now
        if reason:
            self.stop_reason = reason
        self.save(update_fields=["status", "stop_time", "last_sync_time", "stop_reason", "updated_at"])

    def touch_sync(self):
        self.last_sync_time = timezone.now()
        self.save(update_fields=["last_sync_time", "updated_at"])


class SyncStatus(models.Model):
    SYNC_PENDING = "PENDING"
    SYNC_IN_PROGRESS = "IN_PROGRESS"
    SYNC_COMPLETED = "COMPLETED"
    SYNC_FAILED = "FAILED"
    SYNC_PENDING_RETRY = "PENDING_RETRY"
    SYNC_RETRYING = "RETRYING"
    SYNC_FAILED_MAX_RETRIES = "FAILED_MAX_RETRIES"
    SYNC_SENT_ON_RETRY = "SENT_ON_RETRY"
    SYNC_SUCCESS = "SUCCESS"

    SYNC_STATUS_CHOICES = [
        (SYNC_PENDING, "Pending"),
        (SYNC_IN_PROGRESS, "In Progress"),
        (SYNC_COMPLETED, "Completed"),
        (SYNC_FAILED, "Failed"),
        (SYNC_PENDING_RETRY, "Pending Retry"),
        (SYNC_RETRYING, "Retrying"),
        (SYNC_FAILED_MAX_RETRIES, "Failed (Max Retries)"),
        (SYNC_SENT_ON_RETRY, "Sent On Retry"),
        (SYNC_SUCCESS, "Success"),
    ]

    SUBSYSTEM_DF = "DF"
    SUBSYSTEM_MONITORING = "MONITORING"
    SUBSYSTEM_DRONE = "DRONE"
    SUBSYSTEM_SATELLITE = "SATELLITE"
    SUBSYSTEM_PASSIVE_CELL = "PASSIVE_CELLULAR"
    SUBSYSTEM_ACTIVE_CELL = "ACTIVE_CELLULAR"

    SUBSYSTEM_CHOICES = [
        (SUBSYSTEM_DF, "Direction Finding"),
        (SUBSYSTEM_MONITORING, "Monitoring"),
        (SUBSYSTEM_DRONE, "Drone Detection"),
        (SUBSYSTEM_SATELLITE, "Satellite"),
        (SUBSYSTEM_PASSIVE_CELL, "Passive Cellular"),
        (SUBSYSTEM_ACTIVE_CELL, "Active Cellular"),
    ]

    id = models.BigAutoField(primary_key=True)
    session = models.ForeignKey(
        TelemetrySession,
        on_delete=models.CASCADE,
        related_name="sync_statuses",
        to_field="session_id",
        db_column="session_id",
    )
    device = models.ForeignKey(
        "device.DeviceInfo",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column="device_id",
        related_name="sync_statuses",
    )
    node_id = models.CharField(max_length=100, blank=True, default="")
    subsystem_type = models.CharField(max_length=100, blank=True, default="", db_index=True)
    device_reference_id = models.CharField(
        max_length=100,
        blank=True,
        default="",
        db_index=True,
        help_text="node_id / drone_id / satellite_id / passive_cellular_id / active_cellular_id",
    )
    sync_status = models.CharField(
        max_length=30,
        choices=SYNC_STATUS_CHOICES,
        default=SYNC_PENDING,
        db_index=True,
    )
    retry_count = models.IntegerField(default=0)
    polling_interval = models.IntegerField(default=10, help_text="Polling interval (seconds)")
    last_sync_timestamp = models.DateTimeField(null=True, blank=True)
    last_retry_timestamp = models.DateTimeField(null=True, blank=True)
    last_failure_timestamp = models.DateTimeField(null=True, blank=True)
    last_error_message = models.TextField(blank=True, default="")
    exported_records = models.IntegerField(default=0)
    csv_file_name = models.CharField(max_length=500, blank=True, default="")
    destination_ip = models.GenericIPAddressField(null=True, blank=True)
    transfer_status = models.CharField(max_length=50, blank=True, default="")
    sync_message = models.TextField(blank=True, default="")
    remarks = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True, null=True, blank=True)

    class Meta:
        db_table = "sync_status"
        ordering = ["-last_sync_timestamp"]
        indexes = [
            models.Index(fields=["session", "sync_status"]),
            models.Index(fields=["subsystem_type", "device_reference_id"]),
        ]

    def __str__(self):
        return f"Sync {self.session.session_id} — {self.subsystem_type or 'GENERIC'} — {self.sync_status}"


class AuditLog(models.Model):
    id = models.BigAutoField(primary_key=True)
    session = models.ForeignKey(
        TelemetrySession,
        on_delete=models.CASCADE,
        related_name="audit_logs",
        to_field="session_id",
        db_column="session_id",
        null=True,
        blank=True,
    )
    username = models.CharField(max_length=100, blank=True, default="")
    action_type = models.CharField(max_length=100, blank=True, default="")
    module_name = models.CharField(max_length=100, blank=True, default="")
    request_payload = models.JSONField(null=True, blank=True)
    response_payload = models.JSONField(null=True, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    status = models.CharField(max_length=50, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "audit_logs"
        ordering = ["-created_at"]

    def __str__(self):
        return f"Audit {self.action_type} by {self.username} @ {self.created_at}"


class _HimshravanTelemetryBase(models.Model):
    id = models.BigAutoField(primary_key=True)
    session = models.ForeignKey(
        TelemetrySession,
        on_delete=models.CASCADE,
        to_field="session_id",
        db_column="session_id",
        related_name="+",
        null=True,
        blank=True,
    )
    device = models.ForeignKey(
        "device.DeviceInfo",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column="device_id",
        related_name="+",
    )
    timestamp = models.DateTimeField(default=timezone.now, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)

    class Meta:
        abstract = True


class DFTelemetry(models.Model):
    id = models.BigAutoField(primary_key=True)
    target_lat = models.FloatField(null=True, blank=True)
    target_long = models.FloatField(null=True, blank=True)
    target_frequency = models.FloatField(null=True, blank=True)
    target_signal_bw = models.CharField(max_length=50, null=True, blank=True)
    target_received_power = models.CharField(max_length=50, null=True, blank=True)

    class Meta:
        db_table = "df_telemetry"

    def __str__(self):
        return f"DFTelemetry ({self.id})"


class MonitoringTelemetry(_HimshravanTelemetryBase):
    node_id = models.CharField(max_length=100, db_index=True)
    center_frequency_hz = models.BigIntegerField(null=True, blank=True)
    threshold_dbm = models.FloatField(null=True, blank=True)
    freq_mhz = models.FloatField(null=True, blank=True)
    power_dbm = models.FloatField(null=True, blank=True)
    protocol = models.CharField(max_length=100, blank=True, default="")
    modulation = models.CharField(max_length=100, blank=True, default="")
    bandwidth_3dbm_khz = models.FloatField(null=True, blank=True)
    occupied_bandwidth_khz = models.FloatField(null=True, blank=True)
    snr = models.FloatField(null=True, blank=True)
    sinad = models.FloatField(null=True, blank=True)
    thd = models.FloatField(null=True, blank=True)
    symbol_rate = models.CharField(max_length=100, blank=True, default="")

    class Meta:
        db_table = "monitoring_telemetry"
        ordering = ["-timestamp"]
        indexes = [
            models.Index(fields=["session", "timestamp"]),
            models.Index(fields=["node_id", "timestamp"]),
        ]

    def __str__(self):
        return f"MON[{self.node_id}] @ {self.timestamp}"


class DroneTelemetry(_HimshravanTelemetryBase):
    drone_id = models.CharField(max_length=100, db_index=True)
    drone_detected = models.BooleanField(default=False)
    drone_type = models.CharField(max_length=100, blank=True, default="")
    drone_latitude = models.FloatField(null=True, blank=True)
    drone_longitude = models.FloatField(null=True, blank=True)
    operator_latitude = models.FloatField(null=True, blank=True)
    operator_longitude = models.FloatField(null=True, blank=True)
    confidence = models.FloatField(null=True, blank=True)
    altitude_m = models.FloatField(null=True, blank=True)
    speed_mps = models.FloatField(null=True, blank=True)
    heading_deg = models.FloatField(null=True, blank=True)

    class Meta:
        db_table = "drone_telemetry"
        ordering = ["-timestamp"]
        indexes = [
            models.Index(fields=["session", "timestamp"]),
            models.Index(fields=["drone_id", "timestamp"]),
        ]

    def __str__(self):
        return f"DRONE[{self.drone_id}] @ {self.timestamp}"


class CellularActiveTelemetry_History(models.Model):
    timestamp = models.DateTimeField(default=timezone.now, db_index=True)
    node_id = models.GenericIPAddressField(null=True, blank=True)
    status = models.CharField(max_length=100, blank=True, default="")

    class Meta:
        db_table = "cellular_active_telemetry"
        ordering = ["-timestamp"]

    def __str__(self):
        return f"CELL_A[{self.node_id}] @ {self.timestamp}"


class CellularPassiveTelemetry_History(models.Model):
    timestamp = models.DateTimeField(default=timezone.now, db_index=True)
    node_id = models.GenericIPAddressField(null=True, blank=True)
    status = models.CharField(max_length=100, blank=True, default="")

    class Meta:
        db_table = "cellular_passive_telemetry"
        ordering = ["-timestamp"]

    def __str__(self):
        return f"CELL_P[{self.node_id}] @ {self.timestamp}"


class SatelliteTelemetry_History(models.Model):
    timestamp = models.DateTimeField(default=timezone.now, db_index=True)
    node_id = models.GenericIPAddressField(null=True, blank=True)
    status = models.CharField(max_length=100, blank=True, default="")

    class Meta:
        db_table = "satellite_telemetry"
        ordering = ["-timestamp"]

    def __str__(self):
        return f"SAT[{self.ip_address}] @ {self.timestamp}"
