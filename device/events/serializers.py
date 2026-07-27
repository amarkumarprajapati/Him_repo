from rest_framework import serializers

from .models import EventLog


class EventLogSerializer(serializers.ModelSerializer):
    severity_color = serializers.CharField(read_only=True)

    class Meta:
        model = EventLog
        fields = [
            "id",
            "session_id",
            "subsystem_type",
            "severity",
            "severity_color",
            "event_type",
            "device_reference_id",
            "message",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]
