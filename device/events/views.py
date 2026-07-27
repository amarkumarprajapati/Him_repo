import psutil
from django.utils import timezone
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.decorators import api_view, permission_classes
from rest_framework.generics import ListAPIView
from rest_framework.permissions import IsAuthenticated

from core.pagination import StandardResultsSetPagination
from core.response import success_response

from .models import EventLog
from .serializers import EventLogSerializer


class EventListView(ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = EventLogSerializer
    pagination_class = StandardResultsSetPagination
    queryset = EventLog.objects.all()

    @extend_schema(
        parameters=[
            OpenApiParameter("severity", type=str, description="CRITICAL/HIGH/MEDIUM/LOW/INFORMATIONAL"),
            OpenApiParameter(
                "subsystem_type",
                type=str,
                description="DF/MONITORING/DRONE/SATELLITE/...",
            ),
            OpenApiParameter("event_type", type=str, description="Specific event type"),
            OpenApiParameter("session_id", type=str, description="Filter by session UUID"),
        ],
        description="List events with optional filters (doc §21.5).",
    )
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

    def get_queryset(self):
        qs = super().get_queryset()
        params = self.request.query_params
        if params.get("severity"):
            qs = qs.filter(severity__iexact=params.get("severity"))
        if params.get("subsystem_type"):
            qs = qs.filter(subsystem_type__iexact=params.get("subsystem_type"))
        if params.get("event_type"):
            qs = qs.filter(event_type__iexact=params.get("event_type"))
        if params.get("session_id"):
            qs = qs.filter(session_id=params.get("session_id"))
        return qs

    def get_paginated_response(self, data):
        response = super().get_paginated_response(data)
        response.data["status"] = "SUCCESS"
        response.data["message"] = "Events retrieved successfully"
        return response


@extend_schema(
    tags=["System"],
    responses={200: dict},
    description="Get current system health metrics (CPU, RAM, disk, network) and log a SYSTEM event.",
)
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def system_health(request):
    cpu_percent = psutil.cpu_percent(interval=1)
    cpu_count = psutil.cpu_count()
    cpu_freq = psutil.cpu_freq()

    mem = psutil.virtual_memory()
    swap = psutil.swap_memory()

    disk = psutil.disk_usage("/")

    net_io = psutil.net_io_counters()
    net_addrs = psutil.net_if_addrs()

    boot_time = psutil.boot_time()

    payload = {
        "timestamp": timezone.now().isoformat(),
        "cpu": {
            "percent": cpu_percent,
            "count": cpu_count,
            "frequency_mhz": round(cpu_freq.current, 2) if cpu_freq else None,
        },
        "memory": {
            "total_mb": round(mem.total / (1024 * 1024), 2),
            "available_mb": round(mem.available / (1024 * 1024), 2),
            "used_mb": round(mem.used / (1024 * 1024), 2),
            "percent": mem.percent,
        },
        "swap": {
            "total_mb": round(swap.total / (1024 * 1024), 2),
            "used_mb": round(swap.used / (1024 * 1024), 2),
            "percent": swap.percent,
        },
        "disk": {
            "total_gb": round(disk.total / (1024 ** 3), 2),
            "used_gb": round(disk.used / (1024 ** 3), 2),
            "free_gb": round(disk.free / (1024 ** 3), 2),
            "percent": disk.percent,
        },
        "network": {
            "bytes_sent": net_io.bytes_sent,
            "bytes_recv": net_io.bytes_recv,
            "packets_sent": net_io.packets_sent,
            "packets_recv": net_io.packets_recv,
            "interfaces": list(net_addrs.keys()),
        },
        "boot_time": boot_time,
    }

    EventLog.objects.create(
        subsystem_type="SYSTEM",
        severity=EventLog.SEVERITY_INFORMATIONAL,
        event_type="INFO",
        device_reference_id="",
        message=f"System health check — CPU {cpu_percent}%, RAM {mem.percent}%",
    )

    return success_response(data=payload, message="System health retrieved")

