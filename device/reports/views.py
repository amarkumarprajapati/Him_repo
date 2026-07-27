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
from events.models import EventLog
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


@extend_schema(
    parameters=[
        OpenApiParameter("session_id", type=str, description="Filter by session UUID", required=False),
    ],
    responses={200: OpenApiTypes.OBJECT},
    description="Statistical report — counts per subsystem (doc §11).",
)
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def statistical_report(request):
    session_id = request.query_params.get("session_id")
    base_filter = {}
    if session_id:
        try:
            session = TelemetrySession.objects.get(session_id=session_id)
        except TelemetrySession.DoesNotExist:
            return error_response("SESSION_NOT_FOUND", "Session not found", status.HTTP_404_NOT_FOUND)
        base_filter["session"] = session

    counts = {key: model.objects.filter(**base_filter).count() for key, model in MODULE_TO_MODEL.items()}
    counts["EVENTS"] = (
        EventLog.objects.filter(session_id=session_id).count() if session_id else EventLog.objects.count()
    )
    counts["SESSIONS"] = (
        TelemetrySession.objects.filter(session_id=session_id).count()
        if session_id
        else TelemetrySession.objects.count()
    )

    return success_response(data=counts, message="Statistical report")


@extend_schema(
    parameters=[
        OpenApiParameter("session_id", type=str, description="Filter by session UUID", required=False),
        OpenApiParameter(
            "module",
            type=str,
            description="DF/MONITORING/DRONE/CELLULAR_ACTIVE/CELLULAR_PASSIVE/SATELLITE",
            required=False,
        ),
    ],
    responses={200: OpenApiTypes.OBJECT},
    description="Analytical report — aggregates such as min/max/avg signal_strength or snr (doc §11).",
)
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def analysis_report(request):
    from django.db.models import Avg, Count, Max, Min

    session_id = request.query_params.get("session_id")
    module = (request.query_params.get("module") or "").upper().strip()

    base_filter = {}
    if session_id:
        try:
            session = TelemetrySession.objects.get(session_id=session_id)
        except TelemetrySession.DoesNotExist:
            return error_response("SESSION_NOT_FOUND", "Session not found", status.HTTP_404_NOT_FOUND)
        base_filter["session"] = session

    metric_field_map = {
        "DF": "power_dbm",
        "MONITORING": "snr",
        "DRONE": "drone_altitude",
        "CELLULAR_ACTIVE": "signal_strength_dbm",
        "CELLULAR_PASSIVE": "signal_strength_dbm",
        "SATELLITE": "snr",
    }

    if module:
        if module not in MODULE_TO_MODEL:
            return error_response(
                "INVALID_MODULE",
                "Allowed: " + ", ".join(MODULE_TO_MODEL.keys()),
                status.HTTP_400_BAD_REQUEST,
            )
        modules = [module]
    else:
        modules = list(MODULE_TO_MODEL.keys())

    data = {}
    for mod in modules:
        Model = MODULE_TO_MODEL[mod]
        field = metric_field_map[mod]
        agg = Model.objects.filter(**base_filter).aggregate(
            count=Count("id"),
            min=Min(field),
            max=Max(field),
            avg=Avg(field),
        )
        data[mod] = {"metric": field, **agg}

    return success_response(data=data, message="Analysis report")


@extend_schema(
    request=OpenApiTypes.OBJECT,
    responses={200: OpenApiTypes.OBJECT},
    description="CSV Export (doc §18.2). Writes a CSV under EXPORTS_DIR and updates sync_status.",
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
def csv_export(request):
    payload = request.data or {}
    session_id = payload.get("session_id")
    module = (payload.get("module") or "").upper().strip()
    selected_fields = payload.get("selected_fields") or []
    destination_ip = payload.get("destination_ip") or ""

    if not session_id:
        return error_response("VALIDATION_ERROR", "session_id is required", status.HTTP_400_BAD_REQUEST)
    if module not in MODULE_TO_MODEL:
        return error_response(
            "INVALID_MODULE",
            "Allowed modules: " + ", ".join(MODULE_TO_MODEL.keys()),
            status.HTTP_400_BAD_REQUEST,
        )

    session = get_object_or_404(TelemetrySession, session_id=session_id)
    Model = MODULE_TO_MODEL[module]
    queryset = Model.objects.filter(session=session)

    # Determine columns
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
