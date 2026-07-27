import os
import sys
import time
import csv
import json
import xml.etree.ElementTree as ET
import logging
import io
import pandas as pd
from datetime import datetime

import django


class C:
    RESET = "\033[0m"
    GREEN = "\033[92m"
    RED = "\033[91m"
    YELLOW = "\033[93m"
    BLUE = "\033[94m"
    CYAN = "\033[96m"
    MAGENTA = "\033[95m"
    DIM = "\033[2m"
    BOLD = "\033[1m"


import smbclient

SMB_CONFIGS = {
    "cellular_passive": {
        "server": "10.10.202.21",
        "share": "nexyte-smb-mss",
        "path": "CellularPassive",
        "username": "sambauser",
        "password": "samba",
    },
    "cellular_active": {
        "server": "10.10.202.23",
        "share": "nexyte-smb-ti",
        "path": "CellularActive",
        "username": "sambauser",
        "password": "samba",
    },
    "satellite": {
        "server": "10.10.202.21",
        "share": "nexyte-smb-mss",
        "path": "Satellite",
        "username": "sambauser",
        "password": "samba",
    },
}



# SMB_CONFIGS = {
#     "cellular_passive": {
#         "server": "10.10.202.21",
#         "share": "nexyte-smb-mss",
#         "path": "CellularPassive",
#         "username": "sambauser",
#         "password": "samba",
#     },
#     "cellular_active": {
#         "server": "10.10.202.21",
#         "share": "nexyte-smb-ti",
#         "path": "CellularActive",
#         "username": "sambauser",
#         "password": "samba",
#     },
#     "satellite": {
#         "server": "10.10.202.21",
#         "share": "nexyte-smb-mss",
#         "path": "Satellite",
#         "username": "sambauser",
#         "password": "samba",
#     },
# }

def setup_smb_sessions():
    for key, config in SMB_CONFIGS.items():
        try:
            smbclient.register_session(
                config["server"], 
                username=config["username"], 
                password=config["password"]
            )
            logger.info(f"Registered SMB session for {config['server']}")
        except Exception as e:
            logger.error(f"Failed to register SMB session for {config['server']}: {e}")

# LOCAL_PATHS = {
#     "cellular_passive": "/home/dell/Documents/July_21/create_runtime_files/CellularPassive",
#     "cellular_active": "/home/dell/Documents/July_21/create_runtime_files/CellularActive",
#     "satellite": "/home/dell/Documents/July_21/create_runtime_files/Satellite",
# }


FILE_PREFIXES = {
    "cellular_passive": "PI2",
    "cellular_active": "GI2",
    "satellite": "SI2",
}

DEVICE_TYPES = {
    "cellular_passive": "PASSIVE_CELL",
    "cellular_active": "ACTIVE_CELL",
    "satellite": "SATELLITE",
}


DEVICE_IPS = {
    "ACTIVE_CELL": "10.10.202.31",
    "PASSIVE_CELL": "10.10.202.32",
    "SATELLITE": "10.10.202.33",
}

POLLING_INTERVAL = 1
OPERATING_STALE_SECONDS = 30

logger = logging.getLogger(__name__)

SOURCE_TYPES = ("cellular_active", "cellular_passive", "satellite")

OP_ACTIVE = "ACTIVE"
OP_INACTIVE = "INACTIVE"


FEED_LOG = {
    "ACTIVE_CELL":  {"action": "", "inserted": 0, "from_ts": None},
    "PASSIVE_CELL": {"action": "", "inserted": 0, "from_ts": None},
    "SATELLITE":    {"action": "", "inserted": 0, "from_ts": None},
}

def setup_django():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(os.path.dirname(script_dir))
    if project_root not in sys.path:
        sys.path.insert(0, project_root)
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
    django.setup()
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )


# ─── File helpers ─────────────────────────────────────────────────────────────

def get_latest_file_info_smb(source_type, prefix):
    config = SMB_CONFIGS[source_type]
    unc_path = rf"\\{config['server']}\{config['share']}\{config['path']}"
    
    files = []
    try:
        with smbclient.scandir(unc_path) as it:
            for entry in it:
                if entry.is_file() and entry.name.startswith(prefix):
                    files.append(entry)
    except Exception as e:
        logger.error(f"Error scanning {unc_path}: {e}")
        return None
    if not files:
        return None
    files.sort(key=lambda e: e.stat().st_mtime, reverse=True)
    latest = files[0]
    return rf"{unc_path}\{latest.name}", latest.stat().st_mtime


def safe_float(value):
    try:
        return float(value) if value not in (None, "", "None", "null") else None
    except Exception:
        return None


def get_field(record, *keys):
    if not isinstance(record, dict):
        return None
    for key in keys:
        if key in record:
            value = record.get(key)
            if value not in (None, "", "None", "null"):
                return value
    return None


def parse_timestamp(ts_str, fallback):
    if not ts_str:
        return fallback
    s = str(ts_str).strip()
    if s.endswith("Z"):
        s = s[:-1]
    if "T" in s:
        date_part, _, time_part = s.partition("T")
        for sign in ("+", "-"):
            if sign in time_part:
                time_part = time_part.split(sign)[0]
        s = f"{date_part}T{time_part}"
    try:
        return datetime.fromisoformat(s)
    except Exception:
        try:
            return datetime.strptime(s, "%Y-%m-%d %H:%M:%S")
        except Exception:
            return fallback


def read_file(path):
    try:
        with smbclient.open_file(path, "r", encoding="utf-8") as f:
            return f.read()
    except Exception as e:
        logger.error(f"Failed to read {path}: {e}")
        return None


def parse_csv(content):
    try:
        return list(csv.DictReader(io.StringIO(content)))
    except Exception:
        return []


def parse_xls(file_path):
    try:
        with smbclient.open_file(file_path, "rb") as f:
            file_buffer = io.BytesIO(f.read())
        df = pd.read_excel(file_buffer)
        # Convert NaN to None for JSON compatibility and easier handling
        return df.where(pd.notnull(df), None).to_dict(orient="records")
    except Exception as e:
        logger.error(f"Failed to parse Excel file {file_path}: {e}")
        return []


def parse_json(content):
    try:
        content = content.lstrip('\ufeff')
        data = json.loads(content)
        return data if isinstance(data, list) else [data]
    except Exception:
        return []


def parse_xml(content):
    try:
        root = ET.fromstring(content)
        children = list(root)
        if children and any(list(c) for c in children):
            return [xml_to_dict(c) for c in children]
        return [xml_to_dict(root)]
    except Exception:
        return []


def xml_to_dict(element):
    data = {}
    for child in element:
        if list(child):
            data.update(xml_to_dict(child))
        else:
            data[child.tag] = (child.text or "").strip()
    return data


def ensure_aware(dt):
    from django.utils import timezone
    if dt is None:
        return None
    if timezone.is_naive(dt):
        return timezone.make_aware(dt, timezone.get_current_timezone())
    return dt


def fmt_ts(dt):
    if dt is None:
        return "—"
    try:
        from django.utils import timezone
        local_dt = timezone.localtime(dt) if timezone.is_aware(dt) else dt
        return local_dt.strftime("%H:%M:%S")
    except Exception:
        return str(dt)


# ─── DB operations (no caching — always read from DB) ────────────────────────

def get_history_model(device_type):
    from telemetry.models import (
        CellularActiveTelemetry_History,
        CellularPassiveTelemetry_History,
        SatelliteTelemetry_History,
    )
    return {
        "ACTIVE_CELL": CellularActiveTelemetry_History,
        "PASSIVE_CELL": CellularPassiveTelemetry_History,
        "SATELLITE": SatelliteTelemetry_History,
    }.get(device_type)


def get_history_last_timestamp(device_type):
    from django.db.models import Max
    model = get_history_model(device_type)
    if model is None:
        return None
    return model.objects.aggregate(latest=Max("timestamp"))["latest"]


def get_history_count(device_type):
    model = get_history_model(device_type)
    if model is None:
        return 0
    return model.objects.count()


def save_history_records(device_type, records):
    model = get_history_model(device_type)
    if model is None:
        return 0

    last_ts = ensure_aware(get_history_last_timestamp(device_type))

    to_create = []
    for record in records:
        ts_str = get_field(record, "timestamp", "time", "ts", "Timestamp")
        ts = ensure_aware(parse_timestamp(ts_str, datetime.now()))
        if last_ts is not None and ts is not None and ts <= last_ts:
            continue
        status = get_field(record, "status", "Status") or ""
        to_create.append(model(timestamp=ts, node_id=None, status=status))

    if to_create:
        model.objects.bulk_create(to_create, batch_size=1000)

    return len(to_create)


def sync_device_status():
    """Read telemetry_timestamp from DB, compute ACTIVE/INACTIVE,
    write status + operating_status to DB, return state dict.
    """
    from device.models import DeviceInfo
    from django.utils import timezone

    now = timezone.now()
    state = {}
    for source_type in SOURCE_TYPES:
        device_type = DEVICE_TYPES[source_type]
        row = (
            DeviceInfo.objects.filter(device_type=device_type)
            .order_by("-telemetry_timestamp")
            .first()
        )
        if row is None:
            state[device_type] = (OP_INACTIVE, None)
            continue

        last_ts = ensure_aware(row.updated_at)
        gap = (now - last_ts).total_seconds() if last_ts else 999
        op = OP_ACTIVE if gap <= OPERATING_STALE_SECONDS else OP_INACTIVE
        net_stat = "ONLINE" if op == OP_ACTIVE else "OFFLINE"

        if row.operating_status != op or row.status != op or row.network_status != net_stat:
            DeviceInfo.objects.filter(pk=row.pk).update(
                operating_status=op, 
                status=op,
                network_status=net_stat
            )

        state[device_type] = (op, last_ts)
    return state

def upsert_device_snapshot(device_type, status, ts, file_mtime=None):
    from device.models import DeviceInfo
    from django.utils import timezone
 
    DEVICE_INFO = {
        "ACTIVE_CELL": {
            "node_id": "ACTIVE001",
            "latitude": 26.2290,
            "longitude": 71.9882,
            "station_name": "cellular",
            "quard_id": 0,
        },
        "PASSIVE_CELL": {
            "node_id": "PASSIVE001",
            "latitude": 22.3040,
            "longitude": 87.1216,
            "station_name": "cellular",
            "quard_id": 0,
        },
        "SATELLITE": {
            "node_id": "SAT001",
            "latitude": 22.0563,
            "longitude": 80.8024,
            "station_name": "SATELLITE",
            "quard_id": 0,
        },
    }
 
    info = DEVICE_INFO.get(device_type)
    if not info:
        return
 
    now = timezone.now()
    aware_ts = ensure_aware(ts)
 
    # Use the more recent of record timestamp or file modification time for activity gap
    activity_ts = aware_ts
    if file_mtime:
        aware_mtime = ensure_aware(datetime.fromtimestamp(file_mtime))
        if aware_ts is None or aware_mtime > aware_ts:
            activity_ts = aware_mtime

    gap = (now - activity_ts).total_seconds() if activity_ts else 999
    op = OP_ACTIVE if gap <= OPERATING_STALE_SECONDS else OP_INACTIVE
    net_stat = "ONLINE" if op == OP_ACTIVE else "OFFLINE"
 
    values = {
        "node_id": info["node_id"],
        "latitude": info["latitude"],
        "longitude": info["longitude"],
        "ip_address": DEVICE_IPS.get(device_type),
        "station_name": info["station_name"],
        "quard_id": info["quard_id"],
        "status": status,
        "operating_status": op,
        "network_status": net_stat,
        "telemetry_timestamp": ts,
    }
 
    managed_types = set(DEVICE_TYPES.values())
    if device_type not in managed_types:
        return
 
    rows = list(
        DeviceInfo.objects.filter(device_type=device_type)
        .order_by("created_at")
    )
 
    if rows:
        obj = rows[0]
 
        for field, value in values.items():
            setattr(obj, field, value)
 
        update_fields = list(values.keys())
        if "updated_at" not in update_fields:
            update_fields.append("updated_at")
        obj.save(update_fields=update_fields)
 
        if len(rows) > 1:
            DeviceInfo.objects.filter(
                device_type=device_type
            ).exclude(pk=obj.pk).delete()
 
    else:
        DeviceInfo.objects.create(
            device_type=device_type,
            **values
        )


def cleanup_duplicate_devices():
    """Only deduplicate device types managed by this script (ACTIVE_CELL, PASSIVE_CELL, SATELLITE).
    Never touches DF, DRONE, MONITORING_SENSOR or any other device type.
    """
    from device.models import DeviceInfo
    from django.db.models import Count

    managed_types = set(DEVICE_TYPES.values())  

    dupes = (
        DeviceInfo.objects.filter(device_type__in=managed_types)
        .values("device_type")
        .annotate(n=Count("device_id"))
        .filter(n__gt=1)
    )
    for d in dupes:
        device_type = d["device_type"]
        rows = list(
            DeviceInfo.objects.filter(device_type=device_type).order_by("-telemetry_timestamp")
        )
        keep = rows[0]
        DeviceInfo.objects.filter(device_type=device_type).exclude(pk=keep.pk).delete()


# ─── Process source (DB-only, no caching) ────────────────────────────────────

def process_source(source_type):
    prefix = FILE_PREFIXES[source_type]
    device_type = DEVICE_TYPES[source_type]

    file_info = get_latest_file_info_smb(source_type, prefix)
    if not file_info:
        return

    file_path, file_mtime = file_info

    ext = file_path.lower().split(".")[-1]
    if ext in ("xls", "xlsx"):
        records = parse_xls(file_path)
    else:
        content = read_file(file_path)
        if not content:
            return

        if ext == "json":
            records = parse_json(content)
        elif ext == "xml":
            records = parse_xml(content)
        else:
            records = parse_json(content) or parse_csv(content)

    if not records:
        return

    latest_record = None
    latest_record_ts = None
    for record in records:
        ts_str = get_field(record, "timestamp", "time", "ts", "Timestamp")
        ts = ensure_aware(parse_timestamp(ts_str, datetime.now()))
        if latest_record_ts is None or (ts is not None and ts > latest_record_ts):
            latest_record_ts = ts
            latest_record = record


    db_last_before = ensure_aware(get_history_last_timestamp(device_type))
    inserted = save_history_records(device_type, records)

    if inserted > 0:
        log = FEED_LOG[device_type]
        if db_last_before is not None:
            log["action"] = "backfill"
            log["inserted"] = inserted
            log["from_ts"] = db_last_before
        else:
            log["action"] = "fresh"
            log["inserted"] = inserted
            log["from_ts"] = None
    else:
        FEED_LOG[device_type]["action"] = ""
        FEED_LOG[device_type]["inserted"] = 0

    if latest_record:
        node_id_raw = get_field(latest_record, "node_id", "nodeId", "NodeID", "id")
        node_id = str(node_id_raw).strip() if node_id_raw is not None else None
        latitude = safe_float(get_field(latest_record, "latitude", "lat", "Latitude"))
        longitude = safe_float(get_field(latest_record, "longitude", "lon", "Longitude"))
        status = get_field(latest_record, "status", "Status") or "ONLINE"

        upsert_device_snapshot(
            device_type=device_type,
            status=status,
            ts=latest_record_ts,
            file_mtime=file_mtime,
        )


# ─── Dashboard (reads everything from DB) ────────────────────────────────────

def render_dashboard():
    from django.utils import timezone

    state = sync_device_status()

    now = timezone.now()
    now_wall = datetime.now()
    W = 80
    lines = ["\033[H\033[J"]

    lines.append(f"{C.MAGENTA}{'═' * W}{C.RESET}")
    lines.append(f"{C.BOLD}{C.MAGENTA}  HIMSHRAVAN TELEMETRY MONITOR{C.RESET}"
                 f"{'':>20}{C.CYAN}{now_wall.strftime('%Y-%m-%d %H:%M:%S')}{C.RESET}")
    lines.append(f"{C.MAGENTA}{'═' * W}{C.RESET}")

    lines.append(
        f"{C.CYAN}  {'DEVICE':14}{'STATUS':12}{'COUNTDOWN':10}"
        f"{'TOTAL':8}{'ACTION':30}{C.RESET}"
    )
    lines.append(f"  {'─' * (W - 4)}")

    for source_type in SOURCE_TYPES:
        device_type = DEVICE_TYPES[source_type]
        op, last_ts = state[device_type]
        log = FEED_LOG[device_type]
        fresh = op == OP_ACTIVE

        color = C.GREEN if fresh else C.RED
        dot = "●" if fresh else "○"


        if last_ts is not None:
            since = max(0, int((now - last_ts).total_seconds()))
            remaining = max(0, OPERATING_STALE_SECONDS - since)
            countdown = f"{remaining}s" if fresh else "—"
        else:
            countdown = "—"


        total = get_history_count(device_type) or "—"


        if log["action"] == "backfill":
            action = f"backfill +{log['inserted']} from {fmt_ts(log['from_ts'])}"
        elif log["action"] == "fresh":
            action = f"+{log['inserted']} new"
        else:
            action = "—"

        status_label = f"{dot} {op}"
        lines.append(
            f"{color}  {device_type:14}{status_label:12}{countdown:10}"
            f"{str(total):8}{C.RESET}"
            f"{C.YELLOW if log['action'] == 'backfill' else C.GREEN if log['action'] == 'fresh' else C.DIM}"
            f"{action}{C.RESET}"
        )

    lines.append(f"{C.MAGENTA}{'═' * W}{C.RESET}")


    lines.append(f"{C.CYAN}  DATA FEED{C.RESET}")
    for source_type in SOURCE_TYPES:
        device_type = DEVICE_TYPES[source_type]
        prefix = FILE_PREFIXES[source_type]
        file_info = get_latest_file_info_smb(source_type, prefix)
        db_ts = get_history_last_timestamp(device_type)

        if file_info:
            file_path, file_mtime = file_info
            file_name = os.path.basename(file_path)
            file_ts_dt = datetime.fromtimestamp(file_mtime)
            lines.append(
                f"{C.DIM}  {device_type:14} "
                f"file: {file_name}  "
                f"file_ts: {fmt_ts(file_ts_dt)}  "
                f"db_ts: {fmt_ts(db_ts)}{C.RESET}"
            )
        else:
            lines.append(f"{C.DIM}  {device_type:14} no file found{C.RESET}")

    lines.append(f"  {'─' * (W - 4)}")
    lines.append(f"{C.BLUE}  Press Ctrl+C to stop{C.RESET}")

    sys.stdout.write("\n".join(lines) + "\n")
    sys.stdout.flush()


# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    setup_django()
    setup_smb_sessions()
    cleanup_duplicate_devices()

    running = True

    def stop_handler(sig, frame):
        nonlocal running
        running = False

    import signal
    signal.signal(signal.SIGINT, stop_handler)
    signal.signal(signal.SIGTERM, stop_handler)

    while running:
        try:
            for source_type in SOURCE_TYPES:
                if not running:
                    break
                process_source(source_type)
            if running:
                render_dashboard()
            time.sleep(POLLING_INTERVAL)
        except Exception as e:
            if not running:
                break
            logger.error(f"Error in main loop: {e}", exc_info=True)
            from django.db import connections
            connections.close_all()
            time.sleep(POLLING_INTERVAL)

    print(f"\n{C.YELLOW}🛑 Stopping monitor and marking devices INACTIVE...{C.RESET}")
    try:
        from device.models import DeviceInfo
        managed_types = set(DEVICE_TYPES.values())
        DeviceInfo.objects.filter(device_type__in=managed_types).update(
            operating_status=OP_INACTIVE,
            status=OP_INACTIVE,
            network_status="OFFLINE"
        )
    except Exception as e:
        pass

    from django.db import connections
    connections.close_all()
    print(f"{C.YELLOW}🛑 Monitor stopped{C.RESET}")


if __name__ == "__main__":
    main()
