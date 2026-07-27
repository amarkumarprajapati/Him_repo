import csv
import io
from pathlib import Path

from django.conf import settings
from django.shortcuts import get_object_or_404
from django.utils import timezone
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiExample, OpenApiParameter, extend_schema
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated

from core.response import error_response, success_response
from telemetry.models import (
    CellularActiveTelemetry_History,
    CellularPassiveTelemetry_History,
    DFTelemetry,
    DroneTelemetry,
    MonitoringTelemetry,
    SatelliteTelemetry_History,
    SyncStatus,
    TelemetrySession,
)

from .serializers import SyncExportSerializer, SyncStartSerializer, SyncStatusDetailSerializer

MODULE_TO_MODEL = {
    "DF": DFTelemetry,
    "MONITORING": MonitoringTelemetry,
    "DRONE": DroneTelemetry,
    "CELLULAR_ACTIVE": CellularActiveTelemetry_History,
    "CELLULAR_PASSIVE": CellularPassiveTelemetry_History,
    "SATELLITE": SatelliteTelemetry_History,
}


def _exports_dir() -> Path:
    base = Path(getattr(settings, "EXPORTS_DIR", Path(settings.BASE_DIR) / "exports"))
    base.mkdir(parents=True, exist_ok=True)
    return base


def _cell_value(value):
    if value is None:
        return ""
    if hasattr(value, "session_id"):
        return str(value.session_id)
    if hasattr(value, "pk"):
        return str(value.pk)
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return str(value)


def _latest_for(subsystem_type, device_reference_id):
    return (
        SyncStatus.objects.filter(subsystem_type=subsystem_type, device_reference_id=device_reference_id)
        .order_by("-last_sync_timestamp", "-id")
        .first()
    )


def _detail_response(sync, default_subsystem):
    if not sync:
        return success_response(
            data={
                "subsystem_type": default_subsystem,
                "sync_status": SyncStatus.SYNC_PENDING,
                "exported_records": 0,
                "retry_count": 0,
            },
            message="No synchronization activity yet",
        )
    return success_response(
        data=SyncStatusDetailSerializer(sync).data,
        message="Sync status retrieved",
    )


@extend_schema(
    request=SyncStartSerializer,
    responses={202: SyncStatusDetailSerializer},
    description="Start synchronization for a (session, subsystem, device) triple",
)
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def sync_start(request):
    serializer = SyncStartSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data

    session = get_object_or_404(TelemetrySession, session_id=data["session_id"])
    sync, created = SyncStatus.objects.get_or_create(
        session=session,
        subsystem_type=data.get("subsystem_type", "") or "",
        device_reference_id=data.get("device_reference_id", "") or "",
        defaults={
            "polling_interval": data.get("polling_interval", 10),
            "destination_ip": data.get("destination_ip"),
        },
    )
    if not created:
        sync.polling_interval = data.get("polling_interval", sync.polling_interval)
        if data.get("destination_ip"):
            sync.destination_ip = data["destination_ip"]
    sync.sync_status = SyncStatus.SYNC_IN_PROGRESS
    sync.last_retry_timestamp = timezone.now()
    sync.save()

    return success_response(
        data=SyncStatusDetailSerializer(sync).data,
        message="Synchronization started",
        http_status=status.HTTP_202_ACCEPTED,
    )


@extend_schema(
    request=SyncExportSerializer,
    responses={200: OpenApiTypes.OBJECT},
    description="Export synchronized CSV (doc §18.2).",
    examples=[
        OpenApiExample(
            "Example",
            value={
                "session_id": "e9bcfae2-4489-44a8-b53d-11aa22bb33cc",
                "module": "DRONE",
                "selected_fields": ["drone_id", "drone_status", "drone_latitude", "drone_longitude"],
                "destination_ip": "192.168.20.10",
            },
            request_only=True,
        )
    ],
)
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def sync_export(request):
    serializer = SyncExportSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data

    session_id = data["session_id"]
    module = data["module"].upper().strip()
    selected_fields = data.get("selected_fields") or []
    destination_ip = data.get("destination_ip") or ""

    if module not in MODULE_TO_MODEL:
        return error_response(
            "INVALID_MODULE",
            "Allowed modules: " + ", ".join(MODULE_TO_MODEL.keys()),
            status.HTTP_400_BAD_REQUEST,
        )

    session = get_object_or_404(TelemetrySession, session_id=session_id)
    Model = MODULE_TO_MODEL[module]
    queryset = Model.objects.filter(session=session)

    all_model_fields = [f.name for f in Model._meta.fields]
    default_fields = [f for f in all_model_fields if f not in ("id", "session", "device", "created_at")]
    if not selected_fields:
        selected_fields = default_fields
    else:
        invalid = [f for f in selected_fields if f not in all_model_fields]
        if invalid:
            return error_response(
                "INVALID_FIELDS",
                f"Unknown fields: {', '.join(invalid)}",
                status.HTTP_400_BAD_REQUEST,
            )

    timestamp_token = timezone.now().strftime("%Y%m%d_%H%M%S")
    filename = f"{module.lower()}_{session_id}_{timestamp_token}.csv"
    filepath = _exports_dir() / filename

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(selected_fields)
    record_count = 0
    for obj in queryset.iterator():
        row = [_cell_value(getattr(obj, field, "")) for field in selected_fields]
        writer.writerow(row)
        record_count += 1

    with open(filepath, "w", encoding="utf-8", newline="") as fp:
        fp.write(buffer.getvalue())

    sync, _ = SyncStatus.objects.get_or_create(
        session=session,
        subsystem_type=module,
        defaults={"sync_status": SyncStatus.SYNC_COMPLETED},
    )
    sync.csv_file_name = filename
    sync.exported_records = record_count
    sync.destination_ip = destination_ip or sync.destination_ip
    sync.transfer_status = "PENDING" if destination_ip else ""
    sync.last_sync_timestamp = timezone.now()
    if not sync.sync_status or sync.sync_status == SyncStatus.SYNC_PENDING:
        sync.sync_status = SyncStatus.SYNC_COMPLETED
    sync.save()

    message = (
        "CSV export completed successfully"
        if record_count
        else f"No {module} telemetry records found for the given session."
    )
    return success_response(
        data={
            "csv_file_name": filename,
            "download_url": f"/exports/{filename}",
            "exported_records": record_count,
            "destination_ip": destination_ip,
        },
        message=message,
    )


@extend_schema(
    parameters=[
        OpenApiParameter("session_id", type=str, description="Filter by session UUID"),
        OpenApiParameter(
            "subsystem_type",
            type=str,
            description="DF/MONITORING/DRONE/...",
        ),
    ],
    responses={200: SyncStatusDetailSerializer(many=True)},
    description="Generic sync status — list latest per (subsystem, device).",
)
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def sync_status_overview(request):
    qs = SyncStatus.objects.all()
    if request.query_params.get("session_id"):
        qs = qs.filter(session__session_id=request.query_params["session_id"])
    if request.query_params.get("subsystem_type"):
        qs = qs.filter(subsystem_type__iexact=request.query_params["subsystem_type"])
    qs = qs.order_by("-last_sync_timestamp", "-id")[:200]
    return success_response(
        data=SyncStatusDetailSerializer(qs, many=True).data,
        message="Sync overview retrieved",
    )


@extend_schema(responses={200: SyncStatusDetailSerializer}, description="Get sync status by node_id.")
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def sync_status_node(request, node_id):
    sync = _latest_for(SyncStatus.SUBSYSTEM_DF, node_id) or _latest_for(SyncStatus.SUBSYSTEM_MONITORING, node_id)
    if not sync:
        sync = SyncStatus.objects.filter(node_id=node_id).order_by("-last_sync_timestamp", "-id").first()
    return _detail_response(sync, SyncStatus.SUBSYSTEM_DF)


@extend_schema(responses={200: SyncStatusDetailSerializer}, description="Get sync status by drone_id.")
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def sync_status_drone(request, drone_id):
    sync = _latest_for(SyncStatus.SUBSYSTEM_DRONE, drone_id)
    return _detail_response(sync, SyncStatus.SUBSYSTEM_DRONE)


@extend_schema(responses={200: SyncStatusDetailSerializer}, description="Get sync status by satellite_id.")
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def sync_status_satellite(request, satellite_id):
    sync = _latest_for(SyncStatus.SUBSYSTEM_SATELLITE, satellite_id)
    return _detail_response(sync, SyncStatus.SUBSYSTEM_SATELLITE)


@extend_schema(responses={200: SyncStatusDetailSerializer}, description="Get sync status by passive_cellular_id.")
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def sync_status_passive_cellular(request, passive_cellular_id):
    sync = _latest_for(SyncStatus.SUBSYSTEM_PASSIVE_CELL, passive_cellular_id)
    return _detail_response(sync, SyncStatus.SUBSYSTEM_PASSIVE_CELL)


@extend_schema(responses={200: SyncStatusDetailSerializer}, description="Get sync status by active_cellular_id.")
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def sync_status_active_cellular(request, active_cellular_id):
    sync = _latest_for(SyncStatus.SUBSYSTEM_ACTIVE_CELL, active_cellular_id)
    return _detail_response(sync, SyncStatus.SUBSYSTEM_ACTIVE_CELL)
