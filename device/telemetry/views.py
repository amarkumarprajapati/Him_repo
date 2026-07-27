import csv
import json
import logging
import requests
from datetime import datetime
from pathlib import Path

from django.conf import settings
from django.http import StreamingHttpResponse
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from drf_spectacular.utils import extend_schema
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated

from core.pagination import StandardResultsSetPagination
from core.response import error_response, success_response
from device.models import DeviceInfo

from .models import (
    CellularActiveTelemetry_History,
    CellularPassiveTelemetry_History,
    DroneTelemetry,
    SatelliteTelemetry_History,
)
from .serializers import (
    CellularActiveTelemetryV1Serializer,
    CellularPassiveTelemetryV1Serializer,
    DroneTelemetryV1Serializer,
    SatelliteTelemetryV1Serializer,
)

logger = logging.getLogger(__name__)

DEFAULT_LIMIT = 50

CSV_FIELDS = [
    "timestamp", "drone_id", "drone_detected", "drone_type",
    "drone_latitude", "drone_longitude", "operator_latitude", "operator_longitude",
    "confidence", "altitude_m", "speed_mps", "heading_deg",
    "device_ip", "device_port",
]




# def _drone_stream_generator(drone_devices, csv_path):
#     csv_header_written = False

#     for device in drone_devices:
#         url = f"http://{device.ip_address}:{device.port}/drone-detection"
#         try:
#             resp = requests.get(url, timeout=10, stream=True)
#             resp.raise_for_status()
#         except requests.exceptions.RequestException as e:
#             err = json.dumps({"error": str(e), "device_ip": device.ip_address, "device_port": device.port})
#             yield f"data: {err}\n\n"
#             continue

#         try:
#             for line in resp.iter_lines(decode_unicode=True):
#                 if not line:
#                     continue
#                 if line.startswith("data:"):
#                     line = line[len("data:"):].strip()
#                 if not line:
#                     continue
#                 try:
#                     item = json.loads(line)
#                 except (json.JSONDecodeError, ValueError):
#                     continue

#                 ts_value = item.get("timestamp")
#                 if ts_value:
#                     parsed = parse_datetime(ts_value)
#                     ts_value = parsed if parsed else timezone.now()
#                 else:
#                     ts_value = timezone.now()

#                 DroneTelemetry.objects.create(
#                     device=device,
#                     timestamp=ts_value,
#                     drone_id=item.get("drone_id", "unknown"),
#                     drone_detected=item.get("drone_detected", False),
#                     drone_type=item.get("drone_type", ""),
#                     drone_latitude=item.get("drone_latitude"),
#                     drone_longitude=item.get("drone_longitude"),
#                     operator_latitude=item.get("operator_latitude"),
#                     operator_longitude=item.get("operator_longitude"),
#                     confidence=item.get("confidence"),
#                     altitude_m=item.get("altitude_m"),
#                     speed_mps=item.get("speed_mps"),
#                     heading_deg=item.get("heading_deg"),
#                 )

#                 csv_row = {
#                     "timestamp": ts_value.isoformat() if hasattr(ts_value, "isoformat") else str(ts_value),
#                     "drone_id": item.get("drone_id", "unknown"),
#                     "drone_detected": item.get("drone_detected", False),
#                     "drone_type": item.get("drone_type", ""),
#                     "drone_latitude": item.get("drone_latitude"),
#                     "drone_longitude": item.get("drone_longitude"),
#                     "operator_latitude": item.get("operator_latitude"),
#                     "operator_longitude": item.get("operator_longitude"),
#                     "confidence": item.get("confidence"),
#                     "altitude_m": item.get("altitude_m"),
#                     "speed_mps": item.get("speed_mps"),
#                     "heading_deg": item.get("heading_deg"),
#                     "device_ip": device.ip_address,
#                     "device_port": device.port,
#                 }

#                 try:
#                     csv_path.parent.mkdir(parents=True, exist_ok=True)
#                     with open(csv_path, "a", newline="", encoding="utf-8") as fh:
#                         writer = csv.DictWriter(fh, fieldnames=CSV_FIELDS)
#                         if not csv_header_written:
#                             writer.writeheader()
#                             csv_header_written = True
#                         writer.writerow(csv_row)
#                 except OSError:
#                     pass

#                 yield f"data: {json.dumps(item)}\n\n"

#         except GeneratorExit:
#             resp.close()
#             return
#         except Exception:
#             pass
#         finally:
#             resp.close()




# def _list(model, lookup_field, lookup_value, serializer_class, request):
#     ordering = model._meta.ordering or ["-timestamp"]
#     qs = model.objects.filter(**{lookup_field: lookup_value}).order_by(*ordering)
#     paginator = StandardResultsSetPagination()
#     page = paginator.paginate_queryset(qs, request)
#     if page is None:
#         return success_response(
#             data=serializer_class(qs[:DEFAULT_LIMIT], many=True).data,
#             message="Telemetry retrieved",
#         )
#     response = paginator.get_paginated_response(serializer_class(page, many=True).data)
#     response.data["status"] = "SUCCESS"
#     response.data["message"] = "Telemetry retrieved"
#     return response



# @extend_schema(
#     responses={200: DroneTelemetryV1Serializer(many=True)}, description="Fetch Drone telemetry by drone_id."
# )
# @api_view(["GET"])
# @permission_classes([IsAuthenticated])
# def list_drone(request, drone_id):
#     return _list(DroneTelemetry, "drone_id", drone_id, DroneTelemetryV1Serializer, request)




@extend_schema(
    responses={200: {}},
    description=(
        "List all telemetry files by scanning the base directory for folders whose name ends with "
        "a known device type (e.g. pune_DRONE, mumbai_DRONE, pune_1_DF). "
        "Groups results by station name. Optional ?station_name= query param to filter by station."
    ),
)
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def device_list(request):
    station_name_filter = request.GET.get("station_name", "").strip().lower()

    base_dir = Path(settings.BASE_DIR)
    if not base_dir.exists():
        return error_response("BASE_DIR_NOT_FOUND", f"Base directory {base_dir} does not exist", 404)

    known_device_types = {choice[0] for choice in DeviceInfo.DEVICE_TYPE_CHOICES}

    stations_data = {}
    total_files = 0

    for entry in base_dir.iterdir():
        if not entry.is_dir():
            continue

        dir_name = entry.name
        last_sep = dir_name.rfind("_")
        if last_sep == -1:
            continue

        station_name = dir_name[:last_sep]
        device_type = dir_name[last_sep + 1:]

        if device_type not in known_device_types:
            continue

        if station_name_filter and station_name.lower() != station_name_filter:
            continue

        files = []
        try:
            for file_path in sorted(entry.rglob("*")):
                if file_path.is_file():
                    stat = file_path.stat()
                    files.append({
                        "filename": file_path.name,
                        "relative_path": str(file_path.relative_to(entry)),
                        "size": stat.st_size,
                        "created_at": datetime.fromtimestamp(stat.st_ctime).isoformat(),
                        "modified_at": datetime.fromtimestamp(stat.st_mtime).isoformat(),
                    })
                    total_files += 1
        except Exception as e:
            logger.error(f"Error listing files in {entry}: {e}")
            continue

        if not files:
            continue

        if station_name not in stations_data:
            stations_data[station_name] = {"station_name": station_name, "device_types": {}}

        if device_type not in stations_data[station_name]["device_types"]:
            stations_data[station_name]["device_types"][device_type] = {
                "device_type": device_type,
                "directory": str(entry),
                "files": [],
            }

        stations_data[station_name]["device_types"][device_type]["files"].extend(files)

    if not stations_data:
        return error_response("NO_FILES_FOUND", "No matching telemetry directories or files found", 404)

    stations_list = []
    for station_name, station_data in sorted(stations_data.items()):
        device_types_list = [
            {
                "device_type": dt,
                "directory": dt_data["directory"],
                "files": dt_data["files"],
                "file_count": len(dt_data["files"]),
            }
            for dt, dt_data in sorted(station_data["device_types"].items())
        ]
        stations_list.append({
            "station_name": station_name,
            "device_types": device_types_list,
            "total_files": sum(dt["file_count"] for dt in device_types_list),
        })

    return success_response(
        data={
            "stations": stations_list,
            "total_files": total_files,
            "total_stations": len(stations_list),
        },
        message="Files retrieved successfully",
    )
