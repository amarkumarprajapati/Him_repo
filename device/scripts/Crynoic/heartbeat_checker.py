import os
import sys
import time
import csv
import json
import traceback
import logging
import threading
from datetime import datetime
from pathlib import Path

import requests
import django
import concurrent.futures
import subprocess
import shutil
import smbclient

SMB_CONFIGS = {
    "DF": {
        "server": "10.10.202.22",
        "share": "nexyte-smb-cy",
        "path": "df_drone_info\\DF",
        "username": "hercules",
        "password": "herculesss",
    },
    "DRONE": {
        "server": "10.10.202.22",
        "share": "nexyte-smb-cy",
        "path": "df_drone_info\\DRONE",
        "username": "hercules",
        "password": "herculesss",
    },
}

def setup_smb_sessions(logger):
    registered_servers = set()
    for device_type, config in SMB_CONFIGS.items():
        server = config["server"]
        if server in registered_servers:
            continue
        try:
            smbclient.register_session(
                server,
                username=config["username"],
                password=config["password"]
            )
            logger.info(f"Registered SMB session for {server}")
            registered_servers.add(server)
        except Exception as e:
            logger.error(f"Failed to register SMB session for {server}: {e}")


def setup_logging():
    LOG_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "logs")
    os.makedirs(LOG_DIR, exist_ok=True)
    LOG_FILE = os.path.join(LOG_DIR, "heartbeat.log")
    logger = logging.getLogger("heartbeat_checker")
    logger.setLevel(logging.INFO)
    logger.propagate = False
    fmt = logging.Formatter("%(asctime)s %(levelname)s %(message)s")
    fh = logging.FileHandler(LOG_FILE)
    fh.setFormatter(fmt)
    logger.addHandler(fh)
    sh = logging.StreamHandler(sys.stdout)
    sh.setFormatter(fmt)
    logger.addHandler(sh)
    return logger


def setup_django():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(os.path.dirname(script_dir))
    if project_root not in sys.path:
        sys.path.insert(0, project_root)

    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
    django.setup()


DRONE_MAX_RETRIES = int(os.environ.get("DRONE_MAX_RETRIES", "3"))
DRONE_RETRY_DELAY = float(os.environ.get("DRONE_RETRY_DELAY", "2"))

# Heartbeat persistence: require consecutive checks before changing status
HEARTBEAT_ACTIVE_THRESHOLD = int(os.environ.get("HEARTBEAT_ACTIVE_THRESHOLD", "2"))  # consecutive successes to mark ACTIVE
HEARTBEAT_INACTIVE_THRESHOLD = int(os.environ.get("HEARTBEAT_INACTIVE_THRESHOLD", "3"))  # consecutive failures to mark INACTIVE

_drone_fail_counts = {}
_heartbeat_consecutive_counts = {}  # {pk: {"success": 0, "failure": 0}}


def fetch_drone_configs(logger):
    from device.models import DeviceInfo
    drones = DeviceInfo.objects.filter(
        device_type=DeviceInfo.DEVICE_DRONE,
        ip_address__isnull=False,
    )
    timeout = float(os.environ.get("DRONE_CONFIG_TIMEOUT", "5"))
    for device in drones:
        pk = str(device.pk)
        ip = str(device.ip_address)
        port = device.port or 80
        url = f"http://{ip}:{port}/get_config/drone_detection"
        try:
            resp = requests.get(url, timeout=timeout)
            resp.raise_for_status()
            data = resp.json()
            was_offline = device.csvrunning_status == 0
            DeviceInfo.objects.filter(pk=device.pk).update(
                latitude=data.get("latitude"),
                longitude=data.get("longitude"),
                node_id=data.get("node_id"),
                node_name=data.get("node_name"),
                station_name=data.get("station_name"),
                status=data.get("status"),
                csvrunning_status=1,
            )
            _drone_fail_counts.pop(pk, None)
            if was_offline:
                station = data.get("station_name")
                _reset_drone_csv(device_pk=pk, ip=ip, station_name=station)
                logger.info(f"Drone {pk} CONNECTED - new CSV started")
        except Exception as e:
            _drone_fail_counts[pk] = _drone_fail_counts.get(pk, 0) + 1
            count = _drone_fail_counts[pk]
            if count >= DRONE_MAX_RETRIES:
                DeviceInfo.objects.filter(pk=device.pk).update(
                    csvrunning_status=0,
                    status="inactive",
                    heartbeat_status=DeviceInfo.HEARTBEAT_INACTIVE,
                    network_status=DeviceInfo.NETWORK_OFFLINE,
                )
                logger.info(f"Drone {pk} DISCONNECTED after {count} retries")


DRONE_CSV_FIELDS = [
    "timestamp", "drone_id", "drone_detected", "drone_type",
    "drone_latitude", "drone_longitude", "operator_latitude", "operator_longitude",
    "confidence", "altitude_m", "speed_mps", "heading_deg",
    "device_ip", "device_port",
]


_drone_workers = {}
_drone_workers_lock = threading.Lock()
_drone_csv_paths = {}
_drone_csv_lock = threading.Lock()


def _get_drone_csv_path(device_pk, ip, station_name=None, logger=None):
    if device_pk not in _drone_csv_paths:
        csv_path = _create_new_drone_csv(device_pk, ip, station_name)
        _drone_csv_paths[device_pk] = csv_path
        if csv_path and logger:
            logger.info(f"Created CSV: {csv_path}")
    return _drone_csv_paths[device_pk]


def _create_new_drone_csv(device_pk, ip, station_name=None):
    from device.models import DeviceInfo
    from datetime import datetime

    device = DeviceInfo.objects.filter(pk=device_pk).first()
    if not device or device.device_type != DeviceInfo.DEVICE_DRONE:
        return None

    config = SMB_CONFIGS.get("DRONE")
    if not config:
        return None

    csv_dir = f"\\\\{config['server']}\\{config['share']}\\{config['path']}"
    try:
        smbclient.makedirs(csv_dir, exist_ok=True)
    except Exception:
        pass
    start_ts = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    return f"{csv_dir}\\DRONE_{ip}_{device_pk}_{start_ts}.csv"


def _reset_drone_csv(device_pk=None, ip=None, station_name=None):
    with _drone_csv_lock:
        if device_pk and ip:
            _drone_csv_paths[device_pk] = _create_new_drone_csv(device_pk, ip, station_name)
        else:
            _drone_csv_paths.clear()


# ── DF CSV & worker globals ──────────────────────────────────────────────────

DF_CSV_FIELDS = [
    "timestamp", "target_lat", "target_long", "target_frequency", "target_signal_bw", "target_received_power",
    "device_ip", "device_port",
]

DF_MAX_RETRIES = int(os.environ.get("DF_MAX_RETRIES", "3"))
DF_RETRY_DELAY = float(os.environ.get("DF_RETRY_DELAY", "2"))
DF_POLL_INTERVAL = float(os.environ.get("DF_POLL_INTERVAL", "1"))

_df_workers = {}
_df_workers_lock = threading.Lock()
_df_csv_paths = {}  # {session_id: Path}
_df_csv_lock = threading.Lock()
_df_fail_counts = {}
_df_sessions = {}


def _get_df_csv_path(session_id, ip, session_name, station_name=None):
    """Get or create CSV path based on session_id. Same session = same file."""
    if session_id not in _df_csv_paths:
        from device.models import DeviceInfo
        from datetime import datetime
        
        device = DeviceInfo.objects.filter(ip_address=ip, device_type=DeviceInfo.DEVICE_DF).first()
        if not device or device.device_type != DeviceInfo.DEVICE_DF:
            return None
        
        config = SMB_CONFIGS.get("DF")
        if not config:
            return None
        
        csv_dir = f"\\\\{config['server']}\\{config['share']}\\{config['path']}"
        try:
            smbclient.makedirs(csv_dir, exist_ok=True)
        except Exception:
            pass
        start_ts = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
        csv_path = f"{csv_dir}\\DF_{ip}_{session_name}_{start_ts}.csv"
        _df_csv_paths[session_id] = csv_path
    return _df_csv_paths[session_id]


def fetch_df_sessions(logger):
    """For each DF MASTER with csvrunning_status=0, get or create a session."""
    from device.models import DeviceInfo

    masters = DeviceInfo.objects.filter(
        device_type=DeviceInfo.DEVICE_DF,
        operating_status=DeviceInfo.OPERATING_MASTER,
        ip_address__isnull=False,
    )
    logger.info(f"[DF] Found {masters.count()} MASTER device(s)")
    timeout = float(os.environ.get("DF_CONFIG_TIMEOUT", "5"))

    for device in masters:
        pk = str(device.pk)
        if device.csvrunning_status == 1 and pk in _df_sessions:
            logger.info(f"[DF] Device {pk} already running (csvrunning_status=1), skipping")
            continue

        ip = str(device.ip_address)
        port = device.port or 8081

        # Step 1: Try to get active session
        session_id = None
        get_session_url = f"http://{ip}:{port}/DF/get_active_session"
        logger.info(f"[DF] Checking active session at {get_session_url}")
        try:
            resp = requests.get(get_session_url, timeout=timeout)
            resp.raise_for_status()
            data = resp.json()
            session_id = data.get("session_id")
            session_name = data.get("session_name")
            if session_id:
                logger.info(f"[DF] Device {pk} has active session: {session_id}")
            else:
                logger.info(f"[DF] Device {pk} no session_id in response: {data}")
        except Exception as e:
            logger.warning(f"[DF] Device {pk} get_active_session failed: {e}")
            session_id = None

        # Step 2: If no session, create one
        if not session_id:
            ts = datetime.now().strftime("%Y%m%d_%H%M%S")
            session_name = f"command_session_{ts}"
            create_url = f"http://{ip}:{port}/DF/create_new_session?session_name={session_name}&operation_mode=LF"
            logger.info(f"[DF] Creating new session at {create_url}")
            try:
                resp = requests.get(create_url, timeout=timeout)
                resp.raise_for_status()
                data = resp.json()
                session_id = data.get("session_id")
                session_name = data.get("session_name")
                if session_id:
                    logger.info(f"[DF] Device {pk} created session: {session_id}")
                else:
                    logger.warning(f"[DF] Device {pk} create_session response has no session_id: {data}")
            except Exception as e:
                _df_fail_counts[pk] = _df_fail_counts.get(pk, 0) + 1
                count = _df_fail_counts[pk]
                logger.warning(f"[DF] Device {pk} create_session failed (attempt {count}): {e}")
                if count >= DF_MAX_RETRIES:
                    DeviceInfo.objects.filter(pk=device.pk).update(
                        status="inactive",
                        heartbeat_status=DeviceInfo.HEARTBEAT_INACTIVE,
                        network_status=DeviceInfo.NETWORK_OFFLINE,
                        csvrunning_status=0,
                    )
                    logger.info(f"[DF] Device {pk} marked inactive after {count} retries")
                continue

        if session_id:
            _df_sessions[pk] = {"session_id": session_id, "session_name": session_name, "ip": ip, "port": port}
            DeviceInfo.objects.filter(pk=device.pk).update(csvrunning_status=1)
            _df_fail_counts.pop(pk, None)
            logger.info(f"[DF] Device {pk} CONNECTED - session={session_id}")


def _poll_df_device(logger, device_pk, ip, port, session_id, stop_event):
    """Poll DF/get_targets/<session_id>, save to DFTelemetry + CSV."""
    from device.models import DeviceInfo
    from telemetry.models import DFTelemetry

    device = DeviceInfo.objects.filter(pk=device_pk).first()
    station_name = device.station_name if device else None
    session_name = _df_sessions.get(device_pk, {}).get("session_name", session_id)
    csv_path = _get_df_csv_path(session_id, ip, session_name, station_name)
    url = f"http://{ip}:{port}/DF/get_targets/{session_id}"
    logger.info(f"[DF] Starting poll for device={device_pk} ip={ip} session={session_id}")
    
    # Create CSV with metadata and headers immediately
    if csv_path:
        with _df_csv_lock:
            try:
                needs_header = not smbclient.path.exists(csv_path) or smbclient.path.getsize(csv_path) == 0
                if needs_header:
                    with smbclient.open_file(csv_path, "w", newline="", encoding="utf-8") as fh:
                        # Write metadata section
                        fh.write(f"# Session_ID: {session_id}\n")
                        fh.write(f"# node_id: {device.node_id if device else 'N/A'}\n")
                        fh.write(f"# master_lat: {device.latitude if device else 'N/A'}\n")
                        fh.write(f"# master_long: {device.longitude if device else 'N/A'}\n")
                        fh.write("\n")  # Empty line before data header
                        # Write data header
                        writer = csv.DictWriter(fh, fieldnames=DF_CSV_FIELDS)
                        writer.writeheader()
                    logger.info(f"[DF] Created CSV with metadata: {csv_path}")
            except Exception as e:
                logger.exception(f"[DF] Failed to create CSV metadata header: {e}")

    last_data = None
    fail_count = 0

    while not stop_event.is_set():
        try:
            resp = requests.get(url, timeout=10)
            resp.raise_for_status()
            data = resp.json()
            fail_count = 0

            # Check if session is deactivated
            session_status = data.get("session_status")
            if session_status == "deactivated":
                logger.info(f"[DF] Device {device_pk} session deactivated - stopping")
                DeviceInfo.objects.filter(pk=device_pk).update(csvrunning_status=0)
                _df_sessions.pop(device_pk, None)
                _df_csv_paths.pop(session_id, None)
                break
            
            # Set csvrunning_status to 1 when successfully receiving data
            DeviceInfo.objects.filter(pk=device_pk).update(csvrunning_status=1)

            logs = data.get("logs", [])
            if not logs:
                logger.info(f"[DF] No logs yet for device={device_pk}")
                stop_event.wait(DF_POLL_INTERVAL)
                continue

            log_entry = logs[0]

            target_lat = log_entry.get("estimated_lat")
            target_long = log_entry.get("estimated_long")

            # Skip if data is same as last poll
            current_data = (target_lat, target_long, log_entry.get("frequency"), log_entry.get("power"))
            if current_data == last_data:
                stop_event.wait(DF_POLL_INTERVAL)
                continue
            last_data = current_data
            target_frequency = log_entry.get("frequency")
            target_signal_bw = log_entry.get("bandwidth")
            target_received_power = log_entry.get("power")
            if target_received_power is not None:
                target_received_power = f"{target_received_power}dbm"

            # Save to DFTelemetry
            try:
                DFTelemetry.objects.create(
                    target_lat=target_lat,
                    target_long=target_long,
                    target_frequency=target_frequency,
                    target_signal_bw=target_signal_bw,
                    target_received_power=target_received_power,
                )
                logger.info(f"[DF] Saved DFTelemetry: lat={target_lat} long={target_long} freq={target_frequency} bw={target_signal_bw} power={target_received_power}")
            except Exception:
                logger.exception(f"[DF] Failed to save DFTelemetry for device={device_pk}")

            # Write to CSV
            if csv_path:
                ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                csv_row = {
                    "timestamp": ts,
                    "target_lat": target_lat,
                    "target_long": target_long,
                    "target_frequency": target_frequency,
                    "target_signal_bw": target_signal_bw,
                    "target_received_power": target_received_power,
                    "device_ip": ip,
                    "device_port": port,
                }
                try:
                    with _df_csv_lock:
                        needs_header = not smbclient.path.exists(csv_path) or smbclient.path.getsize(csv_path) == 0
                        with smbclient.open_file(csv_path, "a", newline="", encoding="utf-8") as fh:
                            writer = csv.DictWriter(fh, fieldnames=DF_CSV_FIELDS)
                            if needs_header:
                                writer.writeheader()
                            writer.writerow(csv_row)
                    logger.info(f"[DF] Wrote CSV row to {csv_path}")
                except Exception as e:
                    logger.exception(f"[DF] Failed to write CSV for device={device_pk}: {e}")

        except Exception as e:
            fail_count += 1
            logger.warning(f"[DF] Request failed for device={device_pk} (attempt {fail_count}/{DF_MAX_RETRIES}): {e}")
            if fail_count >= DF_MAX_RETRIES:
                logger.info(f"[DF] Device {device_pk} session lost - resetting to csvrunning_status=0")
                # Reset device so fetch_df_sessions picks it up again
                DeviceInfo.objects.filter(pk=device_pk).update(
                    csvrunning_status=0,
                    status="inactive",
                    heartbeat_status=DeviceInfo.HEARTBEAT_INACTIVE,
                    network_status=DeviceInfo.NETWORK_OFFLINE,
                )
                _df_sessions.pop(device_pk, None)
                _df_csv_paths.pop(session_id, None)
                break

        stop_event.wait(DF_POLL_INTERVAL)


def manage_df_streams(logger):
    """Manage DF polling worker threads for MASTER devices with csvrunning_status=1."""
    from device.models import DeviceInfo

    # One worker per unique IP (not per device)
    active = {}
    for d in DeviceInfo.objects.filter(
        device_type=DeviceInfo.DEVICE_DF,
        operating_status=DeviceInfo.OPERATING_MASTER,
        csvrunning_status=1,
        ip_address__isnull=False,
    ):
        pk = str(d.pk)
        ip = str(d.ip_address)
        if pk in _df_sessions and ip not in active:
            active[ip] = (pk, d.port or 8081, _df_sessions[pk]["session_id"])
        elif pk not in _df_sessions:
            logger.warning(f"[DF] Device {pk} has csvrunning_status=1 but no session stored")
    logger.info(f"[DF] manage_df_streams: {len(active)} active worker(s)")

    # Start workers for newly-active DF IPs
    for ip, (device_pk, port, session_id) in active.items():
        with _df_workers_lock:
            running = ip in _df_workers and _df_workers[ip][0].is_alive()
        if not running:
            stop_event = threading.Event()
            thread = threading.Thread(
                target=_poll_df_device,
                args=(logger, device_pk, ip, port, session_id, stop_event),
                daemon=True,
                name=f"df-poll-{ip}",
            )
            with _df_workers_lock:
                _df_workers[ip] = (thread, stop_event)
            thread.start()

    # Stop workers for IPs no longer active
    with _df_workers_lock:
        current_ips = list(_df_workers.keys())
    for ip in current_ips:
        with _df_workers_lock:
            entry = _df_workers.get(ip)
            alive = entry is not None and entry[0].is_alive()
        if ip not in active or not alive:
            with _df_workers_lock:
                entry = _df_workers.pop(ip, None)
            if entry:
                entry[1].set()
                # Clear CSV path for this IP's session so new file is created when active again
                with _df_workers_lock:
                    for pk, session_info in list(_df_sessions.items()):
                        if session_info.get("ip") == ip:
                            session_id = session_info.get("session_id")
                            if session_id:
                                _df_csv_paths.pop(session_id, None)


def _stream_drone_device(logger, device_pk, ip, port, stop_event):
    from django.utils import timezone
    from django.utils.dateparse import parse_datetime
    from device.models import DeviceInfo
    from telemetry.models import DroneTelemetry

    url = f"http://{ip}:{port}/drone-detection"
    csv_path = _get_drone_csv_path(device_pk, ip, logger=logger)

    try:
        resp = requests.get(url, timeout=10, stream=True)
        resp.raise_for_status()
    except requests.exceptions.RequestException:
        return

    try:
        for line in resp.iter_lines(decode_unicode=True):
            if stop_event.is_set():
                break
            if not line:
                continue
            if line.startswith("data:"):
                line = line[len("data:"):].strip()
            if not line:
                continue
            try:
                item = json.loads(line)
            except (json.JSONDecodeError, ValueError):
                continue

            ts_value = item.get("timestamp")
            if ts_value:
                parsed = parse_datetime(ts_value)
                ts_value = parsed if parsed else timezone.now()
            else:
                ts_value = timezone.now()

            try:
                device = DeviceInfo.objects.filter(pk=device_pk).first()
                DroneTelemetry.objects.create(
                    device=device,
                    timestamp=ts_value,
                    drone_id=item.get("drone_id", "unknown"),
                    drone_detected=item.get("drone_detected", False),
                    drone_type=item.get("drone_type", ""),
                    drone_latitude=item.get("drone_latitude"),
                    drone_longitude=item.get("drone_longitude"),
                    operator_latitude=item.get("operator_latitude"),
                    operator_longitude=item.get("operator_longitude"),
                    confidence=item.get("confidence"),
                    altitude_m=item.get("altitude_m"),
                    speed_mps=item.get("speed_mps"),
                    heading_deg=item.get("heading_deg"),
                )
            except Exception:
                logger.exception(f"Failed to save DroneTelemetry for device={device_pk}")

            csv_row = {
                "timestamp": ts_value.isoformat() if hasattr(ts_value, "isoformat") else str(ts_value),
                "drone_id": item.get("drone_id", "unknown"),
                "drone_detected": item.get("drone_detected", False),
                "drone_type": item.get("drone_type", ""),
                "drone_latitude": item.get("drone_latitude"),
                "drone_longitude": item.get("drone_longitude"),
                "operator_latitude": item.get("operator_latitude"),
                "operator_longitude": item.get("operator_longitude"),
                "confidence": item.get("confidence"),
                "altitude_m": item.get("altitude_m"),
                "speed_mps": item.get("speed_mps"),
                "heading_deg": item.get("heading_deg"),
                "device_ip": ip,
                "device_port": port,
            }
            if csv_path:
                try:
                    with _drone_csv_lock:
                        needs_header = not smbclient.path.exists(csv_path) or smbclient.path.getsize(csv_path) == 0
                        with smbclient.open_file(csv_path, "a", newline="", encoding="utf-8") as fh:
                            writer = csv.DictWriter(fh, fieldnames=DRONE_CSV_FIELDS)
                            if needs_header:
                                writer.writeheader()
                            writer.writerow(csv_row)
                    logger.info(f"[DRONE] Wrote CSV row to {csv_path}")
                except Exception as e:
                    logger.exception(f"[DRONE] Failed to write CSV for device={device_pk}: {e}")
    except Exception:
        pass
    finally:
        resp.close()


def manage_drone_streams(logger):
    from device.models import DeviceInfo

    active = {
        str(d.pk): (str(d.ip_address), d.port or 80)
        for d in DeviceInfo.objects.filter(
            device_type=DeviceInfo.DEVICE_DRONE,
            csvrunning_status=1,
            ip_address__isnull=False,
        )
    }

    # Start workers for newly-active drones (csvrunning_status=1)
    for pk, (ip, port) in active.items():
        with _drone_workers_lock:
            running = pk in _drone_workers and _drone_workers[pk][0].is_alive()
        if not running:
            stop_event = threading.Event()
            thread = threading.Thread(
                target=_stream_drone_device,
                args=(logger, pk, ip, port, stop_event),
                daemon=True,
                name=f"drone-stream-{pk}",
            )
            with _drone_workers_lock:
                _drone_workers[pk] = (thread, stop_event)
            thread.start()

    # Stop workers for drones no longer active, or restart dead ones
    with _drone_workers_lock:
        current_pks = list(_drone_workers.keys())
    for pk in current_pks:
        with _drone_workers_lock:
            entry = _drone_workers.get(pk)
            alive = entry is not None and entry[0].is_alive()
        if pk not in active or not alive:
            with _drone_workers_lock:
                entry = _drone_workers.pop(pk, None)
                # Clear CSV path so a new file is created when device becomes active again
                _drone_csv_paths.pop(pk, None)
            if entry:
                entry[1].set()


def check_heartbeats_once(logger, dry_run=False):
    from device.models import DeviceInfo

    total = DeviceInfo.objects.count()
    if total == 0:
        logger.info("No devices found; backoff requested.")
        return 2

    qs = DeviceInfo.objects.filter(ip_address__isnull=False).order_by("device_id")
    rows = list(qs.values("pk", "ip_address", "port", "heartbeat_status"))
    rows = [r for r in rows if r.get("ip_address") and str(r.get("ip_address")).strip() != ""]
    if not rows:
        logger.info("No devices with IP address found.")
        return 0

    pks = [r["pk"] for r in rows]
    qs = list(DeviceInfo.objects.filter(pk__in=pks).order_by("device_id"))
    per_device_timeout = float(os.environ.get("HEARTBEAT_DEVICE_TIMEOUT", "3"))
    retries = int(os.environ.get("HEARTBEAT_RETRIES", "2"))
    max_workers_env = os.environ.get("HEARTBEAT_MAX_WORKERS")
    max_workers_cap = int(os.environ.get("HEARTBEAT_MAX_WORKERS_CAP", "50"))
    num_devices = len(qs)
    if max_workers_env:
        try:
            max_workers = int(max_workers_env)
        except Exception:
            max_workers = min(max(1, num_devices), max_workers_cap)
    else:
        # default: process up to `num_devices` concurrently, but cap it
        max_workers = min(max(1, num_devices), max_workers_cap)

    logger.info(f"Heartbeat check: {num_devices} device(s), timeout={per_device_timeout}s")

    # Ensure fping is available
    fping_path = shutil.which("fping")
    if not fping_path:
        logger.error("fping not found in PATH; please install fping")
        return 1

    timeout_ms = int(per_device_timeout * 1000)

    # If dry-run requested, print which IPs would be pinged and exit
    if dry_run:
        logger.info("Dry-run: listing devices that would be pinged:")
        for device in qs:
            logger.info(f"{device.pk}: {device.ip_address}")
        return 0

    # Service health-check endpoints per device type
    SERVICE_HEALTH_MAP = {
        DeviceInfo.DEVICE_DF: "DF/health",
        DeviceInfo.DEVICE_DRONE: "get_config/drone_detection",
        DeviceInfo.DEVICE_MONITORING: "get_config/monitoring",
    }

    # Helper to check one device using fping + service health check
    def _check_device(device):
        ip = str(device.ip_address)
        port = device.port or 80
        # Step 1: fping - check if IP is reachable on the network
        for attempt in range(1, retries + 1):
            try:
                proc = subprocess.run([fping_path, "-c1", "-t", str(timeout_ms), ip], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
                if proc.returncode == 0:
                    break
                else:
                    if attempt >= retries:
                        return (device.pk, device.heartbeat_status, DeviceInfo.HEARTBEAT_INACTIVE, None)
            except Exception:
                return (device.pk, device.heartbeat_status, DeviceInfo.HEARTBEAT_INACTIVE, None)

        # Step 2: HTTP service check - verify the actual service is responding
        endpoint = SERVICE_HEALTH_MAP.get(device.device_type)
        if endpoint:
            url = f"http://{ip}:{port}/{endpoint}"
            for attempt in range(1, retries + 1):
                try:
                    resp = requests.get(url, timeout=per_device_timeout)
                    if resp.status_code == 200:
                        data = resp.json()
                        return (device.pk, device.heartbeat_status, DeviceInfo.HEARTBEAT_ACTIVE, data)
                    else:
                        if attempt >= retries:
                            return (device.pk, device.heartbeat_status, DeviceInfo.HEARTBEAT_INACTIVE, None)
                except Exception:
                    if attempt >= retries:
                        return (device.pk, device.heartbeat_status, DeviceInfo.HEARTBEAT_INACTIVE, None)
        else:
            # No service endpoint defined — fping success is enough
            return (device.pk, device.heartbeat_status, DeviceInfo.HEARTBEAT_ACTIVE, None)


    results = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as exc:
        future_to_pk = {exc.submit(_check_device, device): device.pk for device in qs}
        for fut in concurrent.futures.as_completed(future_to_pk):
            try:
                res = fut.result()
            except Exception:
                continue
            results.append(res)


    for item in results:
        if not item:
            continue
        if len(item) >= 3 and item[2]:
            pk, old_status, new_status, data = item[0], item[1], item[2], item[3] if len(item) > 3 else None
            device = DeviceInfo.objects.filter(pk=pk).first()
            if not device:
                continue

            # Initialize counters for this device
            if pk not in _heartbeat_consecutive_counts:
                _heartbeat_consecutive_counts[pk] = {"success": 0, "failure": 0}

            counters = _heartbeat_consecutive_counts[pk]

            if new_status == DeviceInfo.HEARTBEAT_ACTIVE:
                # Check succeeded: increment success, reset failure
                counters["success"] += 1
                counters["failure"] = 0

                # Only mark ACTIVE after consecutive successes
                if counters["success"] >= HEARTBEAT_ACTIVE_THRESHOLD:
                    # Extract status from response data based on device type
                    device_status = "active"
                    if data:
                        if device.device_type == DeviceInfo.DEVICE_DF:
                            # DF response is nested: {node_id: {status: "...", ...}}
                            # Find the entry matching this device's node_id
                            node_id = str(device.node_id) if device.node_id else None
                            if node_id and node_id in data:
                                device_status = data[node_id].get("status", "active")
                        else:
                            # Monitoring and Drone have direct status field
                            device_status = data.get("status", "active")

                    DeviceInfo.objects.filter(pk=pk).update(
                        heartbeat_status=new_status,
                        network_status=DeviceInfo.NETWORK_ONLINE,
                        status=device_status,
                    )
            else:
                # Check failed: increment failure, reset success
                counters["failure"] += 1
                counters["success"] = 0

                # Only mark INACTIVE after consecutive failures
                if counters["failure"] >= HEARTBEAT_INACTIVE_THRESHOLD:
                    DeviceInfo.objects.filter(pk=pk).update(
                        heartbeat_status=new_status,
                        network_status=DeviceInfo.NETWORK_OFFLINE,
                        status="inactive",
                        csvrunning_status=0,
                    )

    fetch_drone_configs(logger)
    manage_drone_streams(logger)
    fetch_df_sessions(logger)
    manage_df_streams(logger)
    return 0


def _shutdown_all_workers(logger):
    """Stop all background polling threads cleanly."""
    with _drone_workers_lock:
        for pk, (thread, stop_event) in list(_drone_workers.items()):
            stop_event.set()
        _drone_workers.clear()

    with _df_workers_lock:
        for ip, (thread, stop_event) in list(_df_workers.items()):
            stop_event.set()
        _df_workers.clear()

    # Clear thread pool references so atexit handler won't block
    try:
        concurrent.futures.thread._threads_queues.clear()
    except AttributeError:
        pass

    logger.info("All background workers signalled to stop")


def main_loop():
    logger = setup_logging()
    setup_django()
    
    # Register SMB session
    setup_smb_sessions(logger)

    logger.info("Heartbeat checker started")
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--once", action="store_true", help="Run one iteration and exit (for debugging)")
    parser.add_argument("--dry-run", action="store_true", help="List device IPs that would be pinged and exit")
    args, _ = parser.parse_known_args()
    while True:
        try:
            rc = check_heartbeats_once(logger, dry_run=args.dry_run)
            if rc == 2:
                logger.info("No devices; sleeping 300s")
                time.sleep(300)
            else:
                if args.once or args.dry_run:
                    logger.info("--once or --dry-run provided; exiting after single iteration")
                    break
                time.sleep(3)
        except KeyboardInterrupt:
            logger.info("Heartbeat checker stopping via KeyboardInterrupt")
            _shutdown_all_workers(logger)
            break


if __name__ == "__main__":
    main_loop()
