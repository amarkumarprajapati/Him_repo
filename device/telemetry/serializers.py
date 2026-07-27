from rest_framework import serializers

from .models import (
    CellularActiveTelemetry_History,
    CellularPassiveTelemetry_History,
    DFTelemetry,
    DroneTelemetry,
    MonitoringTelemetry,
    SatelliteTelemetry_History,
)


class DFTelemetryV1Serializer(serializers.ModelSerializer):
    session_id = serializers.UUIDField(write_only=True, required=False)

    class Meta:
        model = DFTelemetry
        exclude = ["session"]

    def create(self, validated_data):
        session_id = validated_data.pop("session_id", None)
        if session_id:
            from .models import TelemetrySession

            try:
                validated_data["session"] = TelemetrySession.objects.get(session_id=session_id)
            except TelemetrySession.DoesNotExist as err:
                raise serializers.ValidationError({"session_id": ["Session not found."]}) from err
        return super().create(validated_data)


class MonitoringTelemetryV1Serializer(DFTelemetryV1Serializer):
    class Meta:
        model = MonitoringTelemetry
        exclude = ["session", "device"]


class DroneTelemetryV1Serializer(DFTelemetryV1Serializer):
    class Meta:
        model = DroneTelemetry
        exclude = ["session", "device"]


class CellularActiveTelemetryV1Serializer(DFTelemetryV1Serializer):
    class Meta:
        model = CellularActiveTelemetry_History
        exclude = ["session", "device"]


class CellularPassiveTelemetryV1Serializer(DFTelemetryV1Serializer):
    class Meta:
        model = CellularPassiveTelemetry_History
        exclude = ["session", "device"]


class SatelliteTelemetryV1Serializer(DFTelemetryV1Serializer):
    class Meta:
        model = SatelliteTelemetry_History
        exclude = ["session", "device"]


class HimshravanHeartbeatSerializer(serializers.Serializer):
    subsystem_name = serializers.CharField(max_length=100, required=False, allow_blank=True, default="")
    ip_address = serializers.IPAddressField()
    port = serializers.IntegerField(required=False, default=80)
