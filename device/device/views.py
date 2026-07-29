import csv
import io
import json
import platform
import signal
import subprocess
import sys
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
import requests
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from core.pagination import StandardResultsSetPagination
from core.response import error_response, success_response
from telemetry.models import AuditLog
from telemetry.services.config import HEALTH_ENDPOINTS
from .models import DeviceInfo
from .serializers import DeviceInfoSerializer, RegionSerializer


_global_executor = None

def _shutdown_executor(signum=None, frame=None):
    global _global_executor
    if _global_executor:
        _global_executor.shutdown(wait=False, cancel_futures=True)
    if signum is not None:
        sys.exit(0)

if threading.current_thread() is threading.main_thread():
    if hasattr(signal, 'SIGINT'):
        signal.signal(signal.SIGINT, _shutdown_executor)
    if hasattr(signal, 'SIGTERM'):
        signal.signal(signal.SIGTERM, _shutdown_executor)

@extend_schema(
    tags=["Device"],
    description="Discover devices by device_type. Filters pre-configured devices from the database by type (DRONE, DF, SATELLITE, MONITORING) and returns all matching entries.",
    parameters=[
        OpenApiParameter("device_type", type=str, required=True, description="Device type to filter: DRONE, DF, SATELLITE, MONITORING"),
    ],
    responses={200: DeviceInfoSerializer(many=True)},
)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def discover_device(request):
    device_type = request.query_params.get("device_type")

    if not device_type:
        return error_response("MISSING_PARAMS", "'device_type' query parameter is required (DRONE, DF, SATELLITE, MONITORING)", 400)

    device_type = device_type.upper()
    DEVICE_TYPE_ALIASES = {
        "MONITORING_SENSOR": DeviceInfo.DEVICE_MONITORING,
    }
    device_type = DEVICE_TYPE_ALIASES.get(device_type, device_type)
    valid_types = [DeviceInfo.DEVICE_DRONE, DeviceInfo.DEVICE_DF, DeviceInfo.DEVICE_SATELLITE, DeviceInfo.DEVICE_MONITORING]

    if device_type not in valid_types:
        return error_response(
            "INVALID_DEVICE_TYPE",
            f"Invalid device_type '{device_type}'. Must be one of: {', '.join(valid_types)}",
            400,
        )

    devices = DeviceInfo.objects.filter(device_type=device_type)

    if not devices.exists():
        return error_response("NO_DEVICES_FOUND", f"No devices found for device_type '{device_type}'", 404)

    DEVICE_ENDPOINT_MAP = {
        DeviceInfo.DEVICE_DF: "DF/get_node",
        DeviceInfo.DEVICE_DRONE: "drone_node_api",
        DeviceInfo.DEVICE_SATELLITE: "satellite_node_api",
    }

    DF_HEALTH_ENDPOINT = "DF/health"

    results = []

    if device_type == DeviceInfo.DEVICE_DF:
        # Hit DF/health once per unique IP, then update all matching devices
        unique_ips = set((d.ip_address, d.port) for d in devices)
        for ip, port in unique_ips:
            health_url = f"http://{ip}:{port}/{DF_HEALTH_ENDPOINT}"
            try:
                resp = requests.get(health_url, timeout=5)
                resp.raise_for_status()
                data = resp.json()

                # Find the node matching this IP in the response
                matched_node = None
                for key, node_info in data.items():
                    if isinstance(node_info, dict) and node_info.get("ip") == ip:
                        matched_node = node_info
                        break

                if not matched_node:
                    continue

                node_id = str(matched_node.get("node_id", "")) or None
                operating_status = matched_node.get("operating_status", "").upper()
                status = matched_node.get("status", "")
                station_name = matched_node.get("site_name", "")

                # Get devices matching this IP (2 per IP: one for df_ant_1, one for df_ant_2)
                ip_devices = [d for d in devices if d.ip_address == ip and d.port == port]
                antenna_keys = ["df_ant_1", "df_ant_2"]

                for idx, device in enumerate(ip_devices):
                    ant_key = antenna_keys[idx] if idx < len(antenna_keys) else None
                    ant_data = matched_node.get(ant_key, {}) if ant_key else {}

                    device.node_id = node_id
                    device.node_name = ant_key
                    device.operating_status = DeviceInfo.OPERATING_MASTER if operating_status == "MASTER" else DeviceInfo.OPERATING_REMOTE
                    device.status = status
                    device.station_name = station_name
                    device.latitude = ant_data.get("latitude") if ant_data.get("latitude") is not None else device.latitude
                    device.longitude = ant_data.get("longitude") if ant_data.get("longitude") is not None else device.longitude
                    device.heartbeat_status = DeviceInfo.HEARTBEAT_ACTIVE
                    device.network_status = DeviceInfo.NETWORK_ONLINE
                    device.save(update_fields=[
                        "node_id", "node_name", "operating_status", "status",
                        "station_name", "latitude", "longitude",
                        "heartbeat_status", "network_status", "updated_at",
                    ])

                    results.append({
                        "node_id": device.node_id,
                        "node_name": device.node_name,
                        "ip_address": ip,
                        "port": port,
                        "health_url": health_url,
                        "status": device.status,
                        "operating_status": device.operating_status,
                        "latitude": device.latitude,
                        "longitude": device.longitude,
                        "station_name": device.station_name,
                    })

            except requests.exceptions.RequestException as e:
                ip_devices = [d for d in devices if d.ip_address == ip and d.port == port]
                for device in ip_devices:
                    device.heartbeat_status = DeviceInfo.HEARTBEAT_INACTIVE
                    device.network_status = DeviceInfo.NETWORK_OFFLINE
                    device.save(update_fields=["heartbeat_status", "network_status", "updated_at"])
                    results.append({
                        "node_id": device.node_id,
                        "node_name": device.node_name,
                        "ip_address": ip,
                        "port": port,
                        "health_url": health_url,
                        "status": "FAILED",
                        "error": str(e),
                    })

    for device in devices:
        ip = device.ip_address
        port = device.port
        endpoint = DEVICE_ENDPOINT_MAP.get(device_type, "device")

        if device_type == DeviceInfo.DEVICE_DF:
            continue
        elif device_type == DeviceInfo.DEVICE_DRONE:
            url = f"http://{ip}:{port}/get_config/drone_detection"
            print(f"[DEBUG] DRONE - Calling URL: {url}")
            try:
                resp = requests.get(url, timeout=5)
                print(f"[DEBUG] DRONE - Response status: {resp.status_code}")
                resp.raise_for_status()
                data = resp.json()
                print(f"[DEBUG] DRONE - Response data: {data}")

                device.node_id = str(data.get("node_id", "")) or device.node_id
                device.node_name = data.get("node_name") or device.node_name
                device.station_name = data.get("station_name") or device.station_name
                device.latitude = data.get("latitude") if data.get("latitude") is not None else device.latitude
                device.longitude = data.get("longitude") if data.get("longitude") is not None else device.longitude
                device.status = data.get("status") or device.status
                device.save(update_fields=[
                    "node_id", "node_name", "station_name", "latitude", "longitude", "status", "updated_at",
                ])
                print(f"[DEBUG] DRONE - Updated device: station_name={device.station_name}, status={device.status}")

                results.append({
                    "node_id": device.node_id,
                    "node_name": device.node_name,
                    "ip_address": ip,
                    "port": port,
                    "url": url,
                    "status": device.status,
                    "station_name": device.station_name,
                    "latitude": device.latitude,
                    "longitude": device.longitude,
                })

            except requests.exceptions.RequestException as e:
                print(f"[DEBUG] DRONE - Request failed: {str(e)}")
                results.append({
                    "node_id": device.node_id,
                    "node_name": device.node_name,
                    "ip_address": ip,
                    "port": port,
                    "url": url,
                    "status": "FAILED",
                    "error": str(e),
                })
        elif device_type == DeviceInfo.DEVICE_MONITORING:
            url = f"http://{ip}:{port}/get_config/monitoring"
            print(f"[DEBUG] MONITORING - Calling URL: {url}")
            try:
                resp = requests.get(url, timeout=5)
                print(f"[DEBUG] MONITORING - Response status: {resp.status_code}")
                resp.raise_for_status()
                data = resp.json()
                print(f"[DEBUG] MONITORING - Response data: {data}")

                device.node_id = str(data.get("node_id", "")) or device.node_id
                device.node_name = data.get("node_name") or device.node_name
                device.station_name = data.get("station_name") or device.station_name
                device.latitude = data.get("latitude") if data.get("latitude") is not None else device.latitude
                device.longitude = data.get("longitude") if data.get("longitude") is not None else device.longitude
                device.status = data.get("status") or device.status
                device.save(update_fields=[
                    "node_id", "node_name", "station_name", "latitude", "longitude", "status", "updated_at",
                ])
                print(f"[DEBUG] MONITORING - Updated device: station_name={device.station_name}, status={device.status}")

                results.append({
                    "node_id": device.node_id,
                    "node_name": device.node_name,
                    "ip_address": ip,
                    "port": port,
                    "url": url,
                    "status": device.status,
                    "station_name": device.station_name,
                    "latitude": device.latitude,
                    "longitude": device.longitude,
                })

            except requests.exceptions.RequestException as e:
                print(f"[DEBUG] MONITORING - Request failed: {str(e)}")
                results.append({
                    "node_id": device.node_id,
                    "node_name": device.node_name,
                    "ip_address": ip,
                    "port": port,
                    "url": url,
                    "status": "FAILED",
                    "error": str(e),
                })
        else:
            url = f"http://{ip}:{port}/{endpoint}"
            try:
                resp = requests.get(url, timeout=5)
                resp.raise_for_status()
                data = resp.json()

                if isinstance(data, dict):
                    data = [data]

                if not data:
                    continue

                node = data[0]
                node_id = str(node.get("node_id", "")) or None
                node_name = node.get("node_name", "") or None
                operating_status = node.get("operating_status", "").upper()
                latitude = node.get("latitude")
                longitude = node.get("longitude")
                status = node.get("status", "")

                device.node_id = node_id
                device.node_name = node_name
                device.operating_status = DeviceInfo.OPERATING_MASTER if operating_status == "MASTER" else DeviceInfo.OPERATING_REMOTE
                device.latitude = latitude
                device.longitude = longitude
                device.status = status
                device.heartbeat_status = DeviceInfo.HEARTBEAT_ACTIVE
                device.network_status = DeviceInfo.NETWORK_ONLINE
                device.save(update_fields=[
                    "node_id", "node_name",
                    "operating_status", "latitude", "longitude", "status",
                    "heartbeat_status", "network_status", "updated_at",
                ])

                results.append({
                    "node_id": device.node_id,
                    "node_name": device.node_name,
                    "ip_address": ip,
                    "port": port,
                    "url": url,
                    "status": status,
                    "operating_status": device.operating_status,
                    "latitude": latitude,
                    "longitude": longitude,
                })

            except requests.exceptions.RequestException as e:
                device.heartbeat_status = DeviceInfo.HEARTBEAT_INACTIVE
                device.network_status = DeviceInfo.NETWORK_OFFLINE
                device.save(update_fields=["heartbeat_status", "network_status", "updated_at"])
                results.append({
                    "node_id": device.node_id,
                    "ip_address": ip,
                    "port": port,
                    "url": url,
                    "status": "FAILED",
                    "error": str(e),
                })

    _device_audit_log(
        request,
        "DISCOVER_DEVICE",
        {"device_type": device_type},
        {"total": len(results), "success": sum(1 for r in results if r["status"] == "SUCCESS")},
    )

    success_count = sum(1 for r in results if r["status"] == "SUCCESS")
    return success_response(
        data=results,
        message=f"Discovered {len(results)} node(s) of type '{device_type}': {success_count} reachable, {len(results) - success_count} unreachable",
    )



@extend_schema(
    tags=["Device"],
    description="List all registered devices from database.",
    parameters=[
        OpenApiParameter("device_type", type=str, description="Filter by device type (NODE, DRONE, etc.)"),
        OpenApiParameter("network_status", type=str, description="Filter by ONLINE / OFFLINE"),
    ],
    responses={200: DeviceInfoSerializer(many=True)},
)
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def list_devices(request):
    qs = DeviceInfo.objects.all()
    if request.query_params.get("device_type"):
        qs = qs.filter(device_type=request.query_params["device_type"])
    if request.query_params.get("network_status"):
        qs = qs.filter(network_status=request.query_params["network_status"])

    paginator = StandardResultsSetPagination()
    page = paginator.paginate_queryset(qs, request)
    if page is not None:
        response = paginator.get_paginated_response(DeviceInfoSerializer(page, many=True).data)
        response.data["status"] = "SUCCESS"
        response.data["message"] = "Device list retrieved"
        return response
    return success_response(
        data=DeviceInfoSerializer(qs[:100], many=True).data,
        message="Device list retrieved",
    )


@extend_schema(
    tags=["Device"],
    description="Add a new device to the DeviceInfo table.",
    request=DeviceInfoSerializer,
    responses={201: DeviceInfoSerializer},
)
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def add_device(request):
    serializer = DeviceInfoSerializer(data=request.data)
    if not serializer.is_valid():
        return error_response("INVALID_PARAMS", serializer.errors, 400)

    device = serializer.save()

    _device_audit_log(
        request,
        "ADD_DEVICE",
        request.data,
        {"device_id": str(device.device_id)},
    )

    return success_response(data=DeviceInfoSerializer(device).data, message="Device created", http_status=201)



@extend_schema(
    tags=["Device"],
    description="Sync nodes from a master device. Hits /get_node to fetch master info, "
                "then /get_connected_node to fetch all connected remote sub-nodes and saves them.",
    parameters=[
        OpenApiParameter("ip", type=str, required=True, description="Master IP address"),
        OpenApiParameter("port", type=int, required=True, description="Master port"),
    ],
    responses={200: DeviceInfoSerializer(many=True)},
)
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_sensor(request):
    master_ip = request.query_params.get("ip")
    master_port = request.query_params.get("port")

    if not master_ip or not master_port:
        return error_response("MISSING_PARAMS", "Both 'ip' and 'port' query parameters are required", 400)

    get_node_url = f"http://{master_ip}:{master_port}/get_node"
    try:
        resp = requests.get(get_node_url, timeout=10)
        resp.raise_for_status()
        node_data = resp.json()
    except requests.exceptions.RequestException as e:
        return error_response("MASTER_UNREACHABLE", f"Could not reach master at {get_node_url}: {str(e)}", 400)
    except ValueError:
        return error_response("INVALID_JSON", f"Invalid JSON response from {get_node_url}", 400)

    if node_data.get("operating_status") != "MASTER":
        return error_response(
            "NOT_MASTER",
            f"Node at {get_node_url} has operating_status='{node_data.get('operating_status')}', expected MASTER",
            400,
        )

    master_device, _ = DeviceInfo.objects.update_or_create(
        node_id=node_data.get("node_id", ""),
        defaults={
            "device_type": DeviceInfo.DEVICE_DF,
            "ip_address": node_data.get("ip_address") or master_ip,
            "port": int(master_port),
            "node_name": node_data.get("node_name", ""),
            "latitude": node_data.get("latitude"),
            "longitude": node_data.get("longitude"),
            "operating_status": DeviceInfo.OPERATING_MASTER,
            "master_device": None,
            "heartbeat_status": DeviceInfo.HEARTBEAT_ACTIVE,
            "network_status": DeviceInfo.NETWORK_ONLINE,
        },
    )

    get_connected_url = f"http://{master_ip}:{master_port}/get_connected_node"
    try:
        resp = requests.get(get_connected_url, timeout=10)
        resp.raise_for_status()
        connected_data = resp.json()
    except requests.exceptions.RequestException as e:
        return error_response(
            "CONNECTED_NODES_UNREACHABLE",
            f"Could not reach {get_connected_url}: {str(e)}",
            400,
        )
    except ValueError:
        return error_response("INVALID_JSON", f"Invalid JSON response from {get_connected_url}", 400)

    master_info = connected_data.get("master", {})
    if master_info.get("latitude") is not None:
        master_device.latitude = master_info["latitude"]
    if master_info.get("longitude") is not None:
        master_device.longitude = master_info["longitude"]
    master_device.save(update_fields=["latitude", "longitude", "updated_at"])

    saved_nodes = [master_device]
    for node in connected_data.get("nodes", []):
        if node.get("operating_status") != "REMOTE":
            continue

        sub_device, _ = DeviceInfo.objects.update_or_create(
            node_id=node.get("node_id", ""),
            defaults={
                "device_type": DeviceInfo.DEVICE_DF,
                "ip_address": node.get("ip_address"),
                "node_name": node.get("node_name", ""),
                "latitude": node.get("latitude"),
                "longitude": node.get("longitude"),
                "operating_status": DeviceInfo.OPERATING_REMOTE,
                "master_device": master_device,
                "heartbeat_status": DeviceInfo.HEARTBEAT_ACTIVE,
                "network_status": DeviceInfo.NETWORK_ONLINE
                if node.get("node_status") == "online"
                else DeviceInfo.NETWORK_OFFLINE,
            },
        )
        saved_nodes.append(sub_device)

    _device_audit_log(
        request,
        "SYNC_NODES",
        {"ip": master_ip, "port": master_port},
        {"master_node_id": master_device.node_id, "sub_node_count": len(saved_nodes) - 1},
    )

    return success_response(
        data=DeviceInfoSerializer(saved_nodes, many=True).data,
        message=f"Synced {len(saved_nodes)} node(s): 1 master + {len(saved_nodes) - 1} remote",
    )


def _ping_ip(ip_address, timeout=2):
    try:
        param = "-n" if platform.system().lower() == "windows" else "-c"
        timeout_param = "-w" if platform.system().lower() == "windows" else "-W"
        timeout_val = str(timeout * 1000) if platform.system().lower() == "windows" else str(timeout)
        result = subprocess.run(
            ["ping", param, "1", timeout_param, timeout_val, ip_address],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=timeout + 2,
        )
        return result.returncode == 0
    except Exception:
        return False


@extend_schema(
    tags=["Device"],
    description="Ping all registered device IPs (master + remote sub-nodes) and return alive/dead status.",
    parameters=[
        OpenApiParameter("operating_status", type=str, description="Filter by MASTER or REMOTE"),
    ],
)
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def ping_nodes(request):
    qs = DeviceInfo.objects.filter(ip_address__isnull=False).exclude(ip_address="")
    op_filter = request.query_params.get("operating_status")
    if op_filter:
        qs = qs.filter(operating_status=op_filter.upper())

    devices = list(qs)
    if not devices:
        return success_response(data=[], message="No devices with IP addresses found")

    ping_results = {}
    global _global_executor
    with ThreadPoolExecutor(max_workers=min(len(devices), 20)) as executor:
        _global_executor = executor
        future_map = {
            executor.submit(_ping_ip, d.ip_address): d for d in devices
        }
        for future in as_completed(future_map):
            device = future_map[future]
            ping_results[device.device_id] = future.result()
        _global_executor = None

    results = []
    for device in devices:
        alive = ping_results.get(device.device_id, False)
        device.network_status = DeviceInfo.NETWORK_ONLINE if alive else DeviceInfo.NETWORK_OFFLINE
        device.save(update_fields=["network_status", "updated_at"])
        results.append({
            "device_id": str(device.device_id),
            "node_id": device.node_id,
            "node_name": device.node_name,
            "ip_address": device.ip_address,
            "operating_status": device.operating_status,
            "master_device": str(device.master_device_id) if device.master_device_id else None,
            "ping_status": "alive" if alive else "dead",
            "network_status": device.network_status,
        })

    alive_count = sum(1 for r in results if r["ping_status"] == "alive")
    _device_audit_log(
        request,
        "PING_NODES",
        {"operating_status": op_filter},
        {"total": len(results), "alive": alive_count, "dead": len(results) - alive_count},
    )

    return success_response(
        data=results,
        message=f"Pinged {len(results)} node(s): {alive_count} alive, {len(results) - alive_count} dead",
    )


def _build_region_payload(quard_id, devices):
    return {
        "quard_id": quard_id,
        "device_count": len(devices),
        "devices": DeviceInfoSerializer(devices, many=True).data,
    }


def _get_region_list(quard_id=None):
    if quard_id is not None:
        quard_ids = [quard_id]
    else:
        quard_ids = (
            DeviceInfo.objects.filter(quard_id__isnull=False)
            .values_list("quard_id", flat=True)
            .distinct()
            .order_by("quard_id")
        )

    regions = []
    for qid in quard_ids:
        devices = list(
            DeviceInfo.objects.filter(quard_id=qid).order_by("-telemetry_timestamp")
        )
        regions.append(_build_region_payload(qid, devices))
    return regions


@extend_schema(
    tags=["Device"],
    description="List devices grouped by region (quard_id). Each region contains all devices assigned to that quard.",
    parameters=[
        OpenApiParameter("quard_id", type=int, description="Filter by region quard_id (e.g. 1=Mumbai, 2=Pune)"),
    ],
    responses={200: RegionSerializer(many=True)},
)
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def list_regions(request):
    quard_id_param = request.query_params.get("quard_id")

    if quard_id_param is not None:
        try:
            quard_id = int(quard_id_param)
        except (TypeError, ValueError):
            return error_response("INVALID_QUARD_ID", "quard_id must be a valid integer", 400)
        regions = _get_region_list(quard_id=quard_id)
        message = f"Region {quard_id} retrieved"
    else:
        regions = _get_region_list()
        message = "Region list retrieved"

    paginator = StandardResultsSetPagination()
    page = paginator.paginate_queryset(regions, request)
    if page is not None:
        response = paginator.get_paginated_response(page)
        response.data["status"] = "SUCCESS"
        response.data["message"] = message
        return response

    return success_response(data=regions, message=message)


def _device_audit_log(request, action, req_payload, resp_payload):
    try:
        AuditLog.objects.create(
            session=None,
            username=getattr(request.user, "username", ""),
            action_type=action,
            module_name="device",
            request_payload=req_payload,
            response_payload=resp_payload,
            ip_address=request.META.get("REMOTE_ADDR"),
            status="SUCCESS",
        )
    except Exception:
        pass


# ---------------------------------------------------------------------------
# Sensor Management – Admin-only lat/lng management for cellular & satellite
# ---------------------------------------------------------------------------

SENSOR_MGMT_TYPES = [
    DeviceInfo.DEVICE_ACTIVE_CELL,
    DeviceInfo.DEVICE_PASSIVE_CELL,
    DeviceInfo.DEVICE_SATELLITE,
]


def _normalize_sensor_row(row):
    return {
        str(key).strip().lower(): value.strip() if isinstance(value, str) else value
        for key, value in row.items()
        if key is not None
    }


def _parse_sensor_location_rows(uploaded_file):
    filename = (uploaded_file.name or "").lower()
    try:
        content = uploaded_file.read().decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise ValueError("Uploaded file must be UTF-8 encoded.") from exc

    if not content.strip():
        raise ValueError("Uploaded file is empty.")

    if filename.endswith(".json"):
        try:
            parsed = json.loads(content)
        except json.JSONDecodeError as exc:
            raise ValueError("Invalid JSON file.") from exc

        if isinstance(parsed, dict):
            for key in ("data", "rows", "items"):
                if isinstance(parsed.get(key), list):
                    parsed = parsed[key]
                    break

        if not isinstance(parsed, list):
            raise ValueError("JSON upload must contain a list of sensor rows.")

        return [_normalize_sensor_row(row) for row in parsed if isinstance(row, dict)]

    if filename.endswith(".csv") or "," in content.splitlines()[0]:
        reader = csv.DictReader(io.StringIO(content))
        if not reader.fieldnames:
            raise ValueError("CSV file must include a header row.")
        return [_normalize_sensor_row(row) for row in reader]

    raise ValueError("Unsupported file format. Use CSV or JSON.")


def _parse_coordinate(value, field_name, minimum, maximum):
    try:
        number = float(value)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"'{field_name}' must be a valid number.") from exc

    if number < minimum or number > maximum:
        raise ValueError(f"'{field_name}' must be between {minimum} and {maximum}.")
    return number


def _find_sensor_device(row):
    filters = {"device_type__in": SENSOR_MGMT_TYPES}
    if row.get("device_id"):
        return DeviceInfo.objects.filter(**filters, device_id=row["device_id"]).first()
    if row.get("node_id"):
        return DeviceInfo.objects.filter(**filters, node_id=row["node_id"]).first()
    if row.get("ip_address"):
        return DeviceInfo.objects.filter(**filters, ip_address=row["ip_address"]).first()
    return None


@extend_schema(
    tags=["Device"],
    description=(
        "List all devices from the database with pagination. "
        "Admin-only."
    ),
    responses={200: DeviceInfoSerializer(many=True)},
)
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def list_all_sensors(request):
    from authentication.permissions import IsSuperAdmin
    if not IsSuperAdmin().has_permission(request, None):
        return error_response("FORBIDDEN", "Admin access required.", 403)

    devices = DeviceInfo.objects.all().order_by("device_type", "node_name")
    
    paginator = StandardResultsSetPagination()
    page = paginator.paginate_queryset(devices, request)
    if page is not None:
        response = paginator.get_paginated_response(DeviceInfoSerializer(page, many=True).data)
        response.data["status"] = "SUCCESS"
        response.data["message"] = "All devices retrieved"
        return response
    
    serializer = DeviceInfoSerializer(devices, many=True)
    return success_response(data=serializer.data, message="All devices retrieved")


@extend_schema(
    tags=["Device"],
    description="Update latitude and/or longitude for a sensor device (Admin-only).",
    responses={200: DeviceInfoSerializer},
)
@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
def update_sensor_location(request, device_id):
    from authentication.permissions import IsSuperAdmin
    if not IsSuperAdmin().has_permission(request, None):
        return error_response("FORBIDDEN", "Admin access required.", 403)

    try:
        device = DeviceInfo.objects.get(device_id=device_id, device_type__in=SENSOR_MGMT_TYPES)
    except DeviceInfo.DoesNotExist:
        return error_response("NOT_FOUND", "Device not found or not a supported sensor type.", 404)

    latitude = request.data.get("latitude")
    longitude = request.data.get("longitude")

    if latitude is None and longitude is None:
        return error_response("MISSING_PARAMS", "Provide at least one of 'latitude' or 'longitude'.", 400)

    update_fields = ["updated_at"]
    if latitude is not None:
        try:
            device.latitude = float(latitude)
            update_fields.append("latitude")
        except (TypeError, ValueError):
            return error_response("INVALID_PARAMS", "'latitude' must be a valid number.", 400)

    if longitude is not None:
        try:
            device.longitude = float(longitude)
            update_fields.append("longitude")
        except (TypeError, ValueError):
            return error_response("INVALID_PARAMS", "'longitude' must be a valid number.", 400)

    device.save(update_fields=update_fields)

    _device_audit_log(
        request,
        "UPDATE_SENSOR_LOCATION",
        {"device_id": str(device_id), "latitude": latitude, "longitude": longitude},
        {"latitude": device.latitude, "longitude": device.longitude},
    )

    serializer = DeviceInfoSerializer(device)
    return success_response(data=serializer.data, message="Sensor location updated")


@extend_schema(
    tags=["Device"],
    description=(
        "Bulk update latitude and longitude for sensor devices from a CSV or JSON file. "
        "Each row must include one of device_id, node_id, or ip_address plus latitude and longitude. Admin-only."
    ),
)
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def upload_sensor_locations(request):
    from authentication.permissions import IsSuperAdmin

    if not IsSuperAdmin().has_permission(request, None):
        return error_response("FORBIDDEN", "Admin access required.", 403)

    uploaded_file = request.FILES.get("file")
    if uploaded_file is None:
        return error_response("MISSING_FILE", "Upload a CSV or JSON file in the 'file' field.", 400)

    try:
        rows = _parse_sensor_location_rows(uploaded_file)
    except ValueError as exc:
        return error_response("INVALID_FILE", str(exc), 400)

    updated_count = 0
    errors = []

    for index, raw_row in enumerate(rows, start=2):
        row = _normalize_sensor_row(raw_row)
        latitude = row.get("latitude")
        longitude = row.get("longitude")

        if latitude in (None, "") and longitude in (None, ""):
            errors.append({"row": index, "message": "Provide latitude and longitude."})
            continue

        device = _find_sensor_device(row)
        if device is None:
            errors.append({
                "row": index,
                "message": "Sensor device not found. Use device_id, node_id, or ip_address for a supported sensor.",
            })
            continue

        try:
            device.latitude = _parse_coordinate(latitude, "latitude", -90, 90)
            device.longitude = _parse_coordinate(longitude, "longitude", -180, 180)
        except ValueError as exc:
            errors.append({"row": index, "message": str(exc)})
            continue

        device.save(update_fields=["latitude", "longitude", "updated_at"])
        updated_count += 1

    _device_audit_log(
        request,
        "UPLOAD_SENSOR_LOCATIONS",
        {"filename": uploaded_file.name, "row_count": len(rows)},
        {"updated_count": updated_count, "failed_count": len(errors)},
    )

    return success_response(
        data={
            "updated_count": updated_count,
            "failed_count": len(errors),
            "errors": errors,
        },
        message="Sensor locations processed",
    )


@extend_schema(
    tags=["Device"],
    description="Get list of unique device types available in the database.",
)
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_device_types(request):
    device_types = DeviceInfo.objects.values_list("device_type", flat=True).distinct().order_by("device_type")
    device_type_list = list(device_types)
    
    return success_response(
        data={"device_types": device_type_list, "count": len(device_type_list)},
        message="Device types retrieved"
    )


@extend_schema(
    tags=["Device"],
    description="Retrieve, partially update (ip_address, latitude, longitude, station_name only), or delete a single device by `device_id`.",
    responses={200: DeviceInfoSerializer},
)
@api_view(["GET", "PATCH", "DELETE"])
@permission_classes([IsAuthenticated])
def device_detail(request, device_id):
    try:
        device = DeviceInfo.objects.get(device_id=device_id)
    except DeviceInfo.DoesNotExist:
        return error_response("NOT_FOUND", "Device not found", 404)

    if request.method == "GET":
        return success_response(data=DeviceInfoSerializer(device).data, message="Device retrieved")

    if request.method == "PATCH":
        # Only allow updating specific fields
        allowed_fields = ["ip_address", "latitude", "longitude", "station_name"]
        update_data = {k: v for k, v in request.data.items() if k in allowed_fields}
        
        if not update_data:
            return error_response(
                "INVALID_PARAMS", 
                f"No valid fields to update. Allowed fields: {', '.join(allowed_fields)}",
                400
            )
        
        serializer = DeviceInfoSerializer(device, data=update_data, partial=True)
        if not serializer.is_valid():
            return error_response("INVALID_PARAMS", serializer.errors, 400)
        device = serializer.save()
        _device_audit_log(
            request,
            "UPDATE_DEVICE",
            {"device_id": str(device_id), "payload": update_data},
            {"device_id": str(device.device_id)},
        )
        return success_response(data=DeviceInfoSerializer(device).data, message="Device updated")

    # DELETE
    device.delete()
    _device_audit_log(request, "DELETE_DEVICE", {"device_id": str(device_id)}, {})
    return success_response(data=None, message="Device deleted")
