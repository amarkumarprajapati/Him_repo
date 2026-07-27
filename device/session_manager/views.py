from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiExample, OpenApiParameter, extend_schema
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated

from core.response import error_response, success_response
from device.models import DeviceInfo
from notifications.models import Notification
from notifications.utils import create_session_notification
from telemetry.models import TelemetrySession

from .serializers import (
    CreateSessionDocsRequestSerializer,
    CreateSessionSerializer,
    SessionDetailResponseSerializer,
    StopSessionSerializer,
    TelemetrySessionSerializer,
)


@extend_schema(
    tags=["Session"],
    request=CreateSessionDocsRequestSerializer,
    description="Create a new telemetry session.",
    examples=[
        OpenApiExample(
            "Example Request",
            value={
                "session_name": "test_lf",
                "operation_mode": "LF",
                "node_id": "9",
                "node_lat": 18.506145,
                "node_long": 73.856589,
            },
            request_only=True,
        )
    ],
)
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def create_session(request):
    s = CreateSessionSerializer(data=request.data)
    s.is_valid(raise_exception=True)
    d = s.validated_data
    node_id = d.get("node_id")
    node_lat = d.get("node_lat")
    node_long = d.get("node_long")

    default_device = (
        DeviceInfo.objects.filter(device_type="NODE").first()
        or DeviceInfo.objects.filter(device_type="DRONE").first()
        or DeviceInfo.objects.all().first()
    )

    if not node_id:
        if default_device:
            node_id = default_device.node_id
        else:
            node_id = "9"

    if node_lat is None:
        if default_device and default_device.latitude is not None:
            node_lat = default_device.latitude
        else:
            node_lat = 18.506145

    if node_long is None:
        if default_device and default_device.longitude is not None:
            node_long = default_device.longitude
        else:
            node_long = 73.856589

    df_ip = (
        d.get("df_system_ip")
        or DeviceInfo.objects.filter(device_type="NODE").values_list("ip_address", flat=True).first()
    )
    drone_ip = (
        d.get("drone_detector_ip")
        or DeviceInfo.objects.filter(device_type="DRONE").values_list("ip_address", flat=True).first()
    )
    sat_ip = (
        d.get("satellite_interception_ip")
        or DeviceInfo.objects.filter(device_type="SATELLITE").values_list("ip_address", flat=True).first()
    )
    cell_p_ip = (
        d.get("cellular_passive_ip")
        or DeviceInfo.objects.filter(device_type__in=["PASSIVE_CELL", "PASSIVE_CELLULAR"])
        .values_list("ip_address", flat=True)
        .first()
    )
    cell_a_ip = (
        d.get("cellular_active_ip")
        or DeviceInfo.objects.filter(device_type__in=["ACTIVE_CELL", "ACTIVE_CELLULAR"])
        .values_list("ip_address", flat=True)
        .first()
    )
    mon_ip = (
        d.get("monitoring_system_ip")
        or DeviceInfo.objects.filter(device_type="MONITORING").values_list("ip_address", flat=True).first()
    )

    session = TelemetrySession.objects.create(
        session_name=d["session_name"],
        operation_mode=d.get("operation_mode", ""),
        session_type=d.get("session_type", "Manual"),
        cyronics_ip=d.get("cyronics_ip"),
        cognizant_ip=d.get("cognizant_ip"),
        monitoring_system_ip=mon_ip,
        df_system_ip=df_ip,
        drone_detector_ip=drone_ip,
        cellular_active_ip=cell_a_ip,
        cellular_passive_ip=cell_p_ip,
        satellite_interception_ip=sat_ip,
        node_id=node_id,
        node_lat=node_lat,
        node_long=node_long,
        polling_interval=d["polling_interval"],
        remarks=d.get("remarks", ""),
        created_by=d.get("created_by") or request.user.username,
        status=TelemetrySession.STATUS_RUNNING,
    )
    create_session_notification(
        title=f"Session '{session.session_name}' created",
        message=f"Session {session.session_name} was created by {request.user.username}.",
        priority=Notification.PRIORITY_LOW,
        session_id=session.session_id,
        session_name=session.session_name,
        action_type="CREATE",
        triggered_by=request.user.username,
    )
    return success_response(
        data={"session_id": str(session.session_id)},
        message="Session created successfully",
        http_status=status.HTTP_201_CREATED,
    )


@extend_schema(
    tags=["Session"],
    request=StopSessionSerializer,
    responses={200: SessionDetailResponseSerializer},
    description="Stop an active telemetry session.",
)
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def stop_session(request):
    s = StopSessionSerializer(data=request.data)
    s.is_valid(raise_exception=True)
    d = s.validated_data

    session = get_object_or_404(TelemetrySession, session_id=d["session_id"])
    session.stop(reason=d.get("stop_reason", ""))
    create_session_notification(
        title=f"Session '{session.session_name}' stopped",
        message=f"Session {session.session_name} was stopped by {request.user.username}.",
        priority=Notification.PRIORITY_MEDIUM,
        session_id=session.session_id,
        session_name=session.session_name,
        action_type="STOP",
        triggered_by=request.user.username,
    )
    return success_response(
        data=TelemetrySessionSerializer(session).data,
        message="Session stopped successfully",
    )


@extend_schema(
    tags=["Session"],
    parameters=[
        OpenApiParameter("session_id", type=str, description="Optional UUID of a specific session"),
    ],
    responses={200: SessionDetailResponseSerializer},
    description="Get the latest active session, or a specific session if session_id is provided (doc §11).",
)
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def session_status_v1(request):
    session_id = request.query_params.get("session_id")
    if session_id:
        import uuid

        from django.core.exceptions import ValidationError

        try:
            uuid.UUID(session_id)
        except (ValueError, ValidationError):
            return error_response("INVALID_UUID", f"'{session_id}' is not a valid UUID string.", 400)

        try:
            session = TelemetrySession.objects.get(session_id=session_id)
        except TelemetrySession.DoesNotExist:
            return error_response("SESSION_NOT_FOUND", f"No session found with session_id={session_id}", 404)
        except (ValueError, ValidationError):
            return error_response("INVALID_UUID", f"'{session_id}' is not a valid UUID string.", 400)
    else:
        session = (
            TelemetrySession.objects.exclude(status=TelemetrySession.STATUS_STOPPED).order_by("-created_at").first()
        )
        if not session:
            return error_response("NO_ACTIVE_SESSION", "No active session found", 404)
    return success_response(
        data=TelemetrySessionSerializer(session).data,
        message="Session status retrieved",
    )


@extend_schema(
    tags=["Session"],
    description="List all telemetry sessions.",
    responses={200: TelemetrySessionSerializer(many=True)},
)
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def list_sessions(request):
    sessions = TelemetrySession.objects.all().order_by("-created_at")
    from core.pagination import StandardResultsSetPagination

    paginator = StandardResultsSetPagination()
    page = paginator.paginate_queryset(sessions, request)
    if page is not None:
        response = paginator.get_paginated_response(TelemetrySessionSerializer(page, many=True).data)
        response.data["status"] = "SUCCESS"
        response.data["message"] = "Telemetry sessions retrieved"
        return response
    return success_response(
        data=TelemetrySessionSerializer(sessions[:100], many=True).data,
        message="Telemetry sessions retrieved",
    )
