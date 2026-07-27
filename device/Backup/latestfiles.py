import os
import sys
import time
import csv
import json
import xml.etree.ElementTree as ET
import logging
import re
import io
from datetime import datetime
from pathlib import Path
import requests
from html.parser import HTMLParser

import django


# ============================================================================
# CONFIGURATION - UPDATE THESE VALUES AS NEEDED
# ============================================================================

IP_ADDRESS = "10.26.40.199"
PORT = "4001"

# Directory listing endpoints — script will browse and pick latest file
DIR_PATHS = {
    "cellular_passive": f"http://{IP_ADDRESS}:{PORT}/home/developer/Documents/Dummyserver/CellularPassive",
    "cellular_active":  f"http://{IP_ADDRESS}:{PORT}/home/developer/Documents/Dummyserver/CellularActive",
    "satellite":        f"http://{IP_ADDRESS}:{PORT}/home/developer/Documents/Dummyserver/Satellite",
}

# Expected filename prefixes per device (used to filter directory listing)
FILE_PREFIXES = {
    "cellular_passive": "PI2",
    "cellular_active":  "GI2",
    "satellite":        "SI2",
}

DEFAULT_DEVICE_IDS = {
    "cellular_passive": "PI2",
    "cellular_active":  "GI2",
    "satellite":        "SI2",
}

POLLING_INTERVAL         = 1    # seconds between poll cycles
CONNECTION_CHECK_INTERVAL = 30  # cycles between connection re-checks
LOG_DIR_NAME  = "logs"
LOG_FILE_NAME = "data_file_monitor.log"

# ============================================================================
# END OF CONFIGURATION
# ============================================================================


class C:
    RESET   = "\033[0m"
    BOLD    = "\033[1m"
    GREEN   = "\033[92m"
    YELLOW  = "\033[93m"
    RED     = "\033[91m"
    CYAN    = "\033[96m"
    BLUE    = "\033[94m"
    MAGENTA = "\033[95m"
    GREY    = "\033[90m"


def cprint(symbol, color, label, msg=""):
    ts = datetime.now().strftime("%H:%M:%S")
    print(f"{C.GREY}{ts}{C.RESET}  {color}{C.BOLD}{symbol} {label}{C.RESET}  {msg}")


def setup_logging():
    LOG_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), LOG_DIR_NAME)
    os.makedirs(LOG_DIR, exist_ok=True)
    LOG_FILE = os.path.join(LOG_DIR, LOG_FILE_NAME)
    logger = logging.getLogger("data_file_monitor")
    logger.setLevel(logging.INFO)
    logger.propagate = False
    fmt = logging.Formatter("%(asctime)s %(levelname)s %(message)s")
    fh = logging.FileHandler(LOG_FILE)
    fh.setFormatter(fmt)
    logger.addHandler(fh)
    return logger


def setup_django():
    script_dir   = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(os.path.dirname(script_dir))
    if project_root not in sys.path:
        sys.path.insert(0, project_root)
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
    django.setup()


# ─── Track which file we last processed per device ───────────────────────────
_last_processed_file = {
    "cellular_passive": {"url": None, "size": None, "last_modified": None},
    "cellular_active":  {"url": None, "size": None, "last_modified": None},
    "satellite":        {"url": None, "size": None, "last_modified": None},
}

# ─── Live dashboard state ────────────────────────────────────────────────────
_STATS = {
    "cellular_passive": {"label": "PI2 (Passive) ", "db": 0, "file": "—", "last_ts": "—", "last_db_ts": "—", "online": None, "reason": ""},
    "cellular_active":  {"label": "GI2 (Active)  ", "db": 0, "file": "—", "last_ts": "—", "last_db_ts": "—", "online": None, "reason": ""},
    "satellite":        {"label": "SI2 (Satellite)", "db": 0, "file": "—", "last_ts": "—", "last_db_ts": "—", "online": None, "reason": ""},
}
_START_TIME   = None
_TOTAL_ERRORS = 0
_DASH_DRAWN   = False
_DASH_HEIGHT  = 16
_ACTIVITY_LOG = []

def _set_conn(key, online, reason=""):
    if key in _STATS:
        _STATS[key]["online"] = online
        if online:
            _STATS[key]["reason"] = ""
        elif reason:
            _STATS[key]["reason"] = reason

def _mark_saved(key, count, filename, last_db_ts=None):
    s = _STATS.get(key)
    if s:
        s["db"] += count
        s["file"] = filename
        if count > 0:
            s["last_ts"] = datetime.now().strftime("%H:%M:%S")
        if last_db_ts:
            if isinstance(last_db_ts, datetime):
                s["last_db_ts"] = last_db_ts.strftime("%Y-%m-%d %H:%M:%S")
            else:
                s["last_db_ts"] = str(last_db_ts)

def log_activity(msg, logger=None):
    ts = datetime.now().strftime("%H:%M:%S")
    formatted_msg = f"{C.GREY}[{ts}]{C.RESET} {msg}"
    _ACTIVITY_LOG.append(formatted_msg)
    if len(_ACTIVITY_LOG) > 4:
        _ACTIVITY_LOG.pop(0)
    if logger:
        logger.info(msg)

def render_dashboard(cycle=0):
    global _DASH_DRAWN
    width = 95
    bar   = "─" * width

    if _START_TIME:
        secs   = int(time.time() - _START_TIME)
        uptime = f"{secs // 3600:02d}:{(secs % 3600) // 60:02d}:{secs % 60:02d}"
    else:
        uptime = "00:00:00"

    online_count = sum(1 for s in _STATS.values() if s["online"] is True)

    lines = []
    lines.append(f"{C.BOLD}{C.MAGENTA}{bar}{C.RESET}")
    lines.append(f"{C.BOLD}{C.MAGENTA}  DATA FILE MONITOR{C.RESET}  {C.GREY}poll {POLLING_INTERVAL}s · uptime {uptime} · cycle #{cycle}{C.RESET}")
    lines.append(f"{C.BOLD}{C.MAGENTA}{bar}{C.RESET}")
    lines.append(f"  {C.BOLD}{'DEVICE':<16} {'STATUS':<12} {'DB SAVES':<10} {'LATEST FILE':<32} {'LATEST DB TS':<20}{C.RESET}")
    lines.append(f"  {C.GREY}{'─' * (width - 2)}{C.RESET}")
    for key in ("cellular_passive", "cellular_active", "satellite"):
        s = _STATS[key]
        if s["online"] is True:
            status = f"{C.GREEN}● ONLINE {C.RESET}"
        elif s["online"] is False:
            status = f"{C.RED}✗ OFFLINE{C.RESET}"
        else:
            status = f"{C.GREY}… INIT   {C.RESET}"
        
        file_display = s["file"]
        if len(file_display) > 30:
            file_display = "..." + file_display[-27:]
            
        db_ts_display = s["last_db_ts"] if s["last_db_ts"] else "—"
            
        lines.append(
            f"  {C.CYAN}{s['label']}{C.RESET}  {status}   "
            f"{s['db']:<10} {file_display:<32} {db_ts_display:<20}"
        )
    lines.append(f"  {C.GREY}{'─' * (width - 2)}{C.RESET}")
    
    reasons = [
        f"{_STATS[k]['label'].strip()}: {_STATS[k]['reason']}"
        for k in _STATS if _STATS[k]["online"] is False and _STATS[k]["reason"]
    ]
    if reasons:
        reason_line = f"{C.YELLOW}⚠ {reasons[0][:width - 6]}{C.RESET}"
    else:
        reason_line = f"{C.GREEN}✓ all endpoints online ({online_count}/3){C.RESET}"
    lines.append(f"  {reason_line}")
    lines.append(f"  {C.GREY}total errors: {_TOTAL_ERRORS}  ·  refreshed {datetime.now().strftime('%H:%M:%S')}{C.RESET}")
    
    lines.append(f"  {C.BOLD}{C.BLUE}LIVE ACTIVITY LOG:{C.RESET}")
    if not _ACTIVITY_LOG:
        lines.append(f"    {C.GREY}No activity yet...{C.RESET}")
        lines.append("")
        lines.append("")
    else:
        logs_to_show = list(_ACTIVITY_LOG)
        while len(logs_to_show) < 3:
            logs_to_show.append("")
        for l in logs_to_show[-3:]:
            lines.append(f"    {l}")
            
    lines.append(f"{C.BOLD}{C.MAGENTA}{bar}{C.RESET}")

    if _DASH_DRAWN:
        sys.stdout.write(f"\033[{_DASH_HEIGHT}F")
    sys.stdout.write("\n".join("\033[2K" + ln for ln in lines) + "\n")
    sys.stdout.flush()
    _DASH_DRAWN = True


# ─── HTML directory listing parser ───────────────────────────────────────────

class _LinkParser(HTMLParser):
    """Extracts all href values from an HTML page (Apache/Nginx-style dir listing)."""
    def __init__(self):
        super().__init__()
        self.links = []

    def handle_starttag(self, tag, attrs):
        if tag == "a":
            for name, value in attrs:
                if name == "href" and value:
                    self.links.append(value)


def _extract_timestamp_from_filename(filename):
    """
    Parse timestamp from filenames like:
      GI2_2026-06-16_10-27_717.xml
      PI2_2026-06-16_10-27_717.csv
      SI2_2026-06-16_10-27_717.json

    Returns a comparable string (already sortable as-is) or '' if no match.
    """
    # Pattern: PREFIX_YYYY-MM-DD_HH-MM_MILLIS.ext
    m = re.search(r'(\d{4}-\d{2}-\d{2}_\d{2}-\d{2}_\d+)', filename)
    return m.group(1) if m else ""


def get_latest_file_info(dir_url, prefix, logger, key):
    """
    Fetch a directory listing page, find all files matching the prefix,
    sort by the embedded timestamp, return the (URL, size, last_modified) of the latest one.
    """
    try:
        resp = requests.get(dir_url, timeout=5)
        resp.raise_for_status()
        _set_conn(key, True)
    except requests.RequestException as e:
        _set_conn(key, False, str(e)[:30])
        logger.error(f"Directory listing failed for {dir_url}: {e}")
        return None

    # Try parsing as JSON first (dummy server structure)
    try:
        data = resp.json()
        if isinstance(data, dict) and "items" in data:
            items = data["items"]
            candidates = []
            for item in items:
                name = item.get("name", "")
                is_file = item.get("type") == "file"
                if is_file and name.upper().startswith(prefix.upper()):
                    candidates.append(item)
            if candidates:
                candidates.sort(key=lambda item: _extract_timestamp_from_filename(item.get("name", "")))
                latest_item = candidates[-1]
                latest_name = latest_item.get("name")
                base = dir_url.rstrip("/")
                return f"{base}/{latest_name}", latest_item.get("size"), latest_item.get("lastModified")
    except (ValueError, TypeError, KeyError) as e:
        logger.debug(f"JSON parsing failed for directory listing, falling back to HTML parser: {e}")

    # Fallback to HTML parser (original behavior)
    parser = _LinkParser()
    parser.feed(resp.text)

    # Keep only links that start with our prefix (case-insensitive)
    candidates = [
        lnk for lnk in parser.links
        if lnk.upper().startswith(prefix.upper()) and not lnk.startswith("?") and not lnk.startswith("/")
    ]

    if not candidates:
        logger.warning(f"No files with prefix '{prefix}' found at {dir_url}")
        return None

    # Sort by the timestamp portion inside the filename — latest = last
    candidates.sort(key=lambda f: _extract_timestamp_from_filename(f))
    latest = candidates[-1]

    # Build absolute URL (strip trailing / then re-add)
    base = dir_url.rstrip("/")
    return f"{base}/{latest}", None, None


# ─── HTTP fetch ───────────────────────────────────────────────────────────────

def http_get_content(url, logger, retries=3, timeout=5):
    last_err = None
    for _ in range(retries):
        try:
            response = requests.get(url, timeout=timeout)
            response.raise_for_status()
            return response.text
        except requests.RequestException as e:
            last_err = e
            time.sleep(0.2)
        except KeyboardInterrupt:
            raise
    logger.warning(f"Could not fetch {url} after {retries} attempts: {last_err}")
    return None


# ─── Parsers — return ALL rows/records (not just last) ───────────────────────

def parse_csv_all(content, logger):
    """Return all rows from CSV content as list of dicts."""
    try:
        rows = list(csv.DictReader(io.StringIO(content)))
        return rows if rows else []
    except Exception as e:
        logger.error(f"CSV parse error: {e}")
        return []


def parse_xml_all(content, logger):
    """
    Return all child record elements from XML.
    Supports two common structures:
      <root><record>...</record><record>...</record></root>   → list of records
      <root><field>val</field>...</root>                      → single record wrapped in list
    """
    try:
        root = ET.fromstring(content)
    except ET.ParseError as e:
        logger.warning(f"XML parse error: {e}")
        return []

    records = []
    children = list(root)

    # If first-level children themselves have children → treat each as a record
    if children and any(list(child) for child in children):
        for child in children:
            record = _xml_element_to_dict(child)
            if record:
                records.append(record)
    else:
        # Flat root — single record
        record = _xml_element_to_dict(root)
        if record:
            records.append(record)

    return records


def _xml_element_to_dict(element):
    """Recursively flatten an XML element into a flat dict."""
    data = {}
    for child in element:
        if list(child):
            data.update(_xml_element_to_dict(child))
        else:
            if child.text and child.text.strip():
                data[child.tag] = child.text.strip()
    # Also capture direct text on the element itself (edge case)
    if element.text and element.text.strip() and not list(element):
        data[element.tag] = element.text.strip()
    return data


def parse_json_all(content, logger):
    """Return all records from JSON content. Handles list or single object."""
    try:
        data = json.loads(content)
        if isinstance(data, list):
            return data
        return [data] if data else []
    except json.JSONDecodeError as e:
        logger.warning(f"JSON parse error: {e}")
        return []


# ─── DB helpers ──────────────────────────────────────────────────────────────

def get_db_last_timestamp(model_class, id_field, id_value):
    try:
        last = model_class.objects.filter(**{id_field: id_value}).order_by('-timestamp').first()
        return last.timestamp if last else None
    except Exception:
        return None


def parse_timestamp(ts_str, fallback):
    if ts_str:
        try:
            return datetime.fromisoformat(str(ts_str).replace('Z', '+00:00'))
        except Exception:
            pass
    return fallback


def safe_float(value):
    if value is None or value == '':
        return None
    try:
        return float(value)
    except (ValueError, TypeError):
        return None


# ─── Connection status display ────────────────────────────────────────────────

# ─── Per-device processors ────────────────────────────────────────────────────

def process_cellular_passive(logger):
    from telemetry.models import CellularPassiveTelemetry
    from django.utils import timezone

    dir_url = DIR_PATHS['cellular_passive']
    prefix  = FILE_PREFIXES['cellular_passive']

    info = get_latest_file_info(dir_url, prefix, logger, 'cellular_passive')
    if not info:
        return
    file_url, size, last_modified = info

    filename = file_url.split("/")[-1]
    _mark_saved('cellular_passive', 0, filename)

    # Skip if we already processed this exact file with same size
    last_info = _last_processed_file['cellular_passive']
    if last_info["url"] == file_url and (size is not None and last_info["size"] == size):
        return

    content = http_get_content(file_url, logger)
    if not content:
        return

    rows = parse_csv_all(content, logger)
    if not rows:
        return

    device_id = rows[0].get('passive_cellular_id', DEFAULT_DEVICE_IDS['cellular_passive'])
    last_ts   = get_db_last_timestamp(CellularPassiveTelemetry, 'passive_cellular_id', device_id)

    saved = 0
    for row in rows:
        ts = parse_timestamp(
            row.get('timestamp') or row.get('time_stamp') or row.get('time'),
            timezone.now()
        )
        if last_ts and ts <= last_ts:
            continue  # already in DB

        try:
            CellularPassiveTelemetry.objects.create(
                timestamp=ts,
                passive_cellular_id=row.get('passive_cellular_id', device_id),
                protocol=row.get('protocol', ''),
                signal_strength_dbm=safe_float(row.get('signal_strength_dbm')),
                frequency_mhz=safe_float(row.get('frequency_mhz')),
                latitude=safe_float(row.get('latitude')),
                longitude=safe_float(row.get('longitude')),
            )
            saved += 1
            last_ts = ts  # update moving watermark
        except Exception as e:
            global _TOTAL_ERRORS
            _TOTAL_ERRORS += 1
            logger.error(f"CellularPassive save error: {e}")

    if saved:
        logger.info(f"CellularPassive: saved {saved} records from {file_url}")
    _mark_saved('cellular_passive', saved, filename)

    _last_processed_file['cellular_passive'] = {
        "url": file_url,
        "size": size,
        "last_modified": last_modified
    }


def process_cellular_active(logger):
    from telemetry.models import CellularActiveTelemetry
    from django.utils import timezone

    dir_url = DIR_PATHS['cellular_active']
    prefix  = FILE_PREFIXES['cellular_active']

    info = get_latest_file_info(dir_url, prefix, logger, 'cellular_active')
    if not info:
        return
    file_url, size, last_modified = info

    filename = file_url.split("/")[-1]
    _mark_saved('cellular_active', 0, filename)

    # Skip if we already processed this exact file with same size
    last_info = _last_processed_file['cellular_active']
    if last_info["url"] == file_url and (size is not None and last_info["size"] == size):
        return

    content = http_get_content(file_url, logger)
    if not content:
        return

    records = parse_xml_all(content, logger)
    if not records:
        return

    device_id = records[0].get('active_cellular_id', DEFAULT_DEVICE_IDS['cellular_active'])
    last_ts   = get_db_last_timestamp(CellularActiveTelemetry, 'active_cellular_id', device_id)

    saved = 0
    for rec in records:
        ts = parse_timestamp(
            rec.get('timestamp') or rec.get('time_stamp') or rec.get('time'),
            timezone.now()
        )
        if last_ts and ts <= last_ts:
            continue

        try:
            CellularActiveTelemetry.objects.create(
                timestamp=ts,
                active_cellular_id=rec.get('active_cellular_id', device_id),
                imsi=rec.get('imsi', ''),
                imei=rec.get('imei', ''),
                operator_name=rec.get('operator_name', ''),
                signal_strength_dbm=safe_float(rec.get('signal_strength_dbm')),
                frequency_mhz=safe_float(rec.get('frequency_mhz')),
                bandwidth_mhz=safe_float(rec.get('bandwidth_mhz')),
                latitude=safe_float(rec.get('latitude')),
                longitude=safe_float(rec.get('longitude')),
            )
            saved += 1
            last_ts = ts
        except Exception as e:
            global _TOTAL_ERRORS
            _TOTAL_ERRORS += 1
            logger.error(f"CellularActive save error: {e}")

    if saved:
        logger.info(f"CellularActive: saved {saved} records from {file_url}")
    _mark_saved('cellular_active', saved, filename)

    _last_processed_file['cellular_active'] = {
        "url": file_url,
        "size": size,
        "last_modified": last_modified
    }


def process_satellite(logger):
    from telemetry.models import SatelliteTelemetry
    from django.utils import timezone

    dir_url = DIR_PATHS['satellite']
    prefix  = FILE_PREFIXES['satellite']

    info = get_latest_file_info(dir_url, prefix, logger, 'satellite')
    if not info:
        return
    file_url, size, last_modified = info

    filename = file_url.split("/")[-1]
    _mark_saved('satellite', 0, filename)

    # Skip if we already processed this exact file with same size
    last_info = _last_processed_file['satellite']
    if last_info["url"] == file_url and (size is not None and last_info["size"] == size):
        return

    content = http_get_content(file_url, logger)
    if not content:
        return

    records = parse_json_all(content, logger)
    if not records:
        return

    device_id = records[0].get('satellite_id', DEFAULT_DEVICE_IDS['satellite'])
    last_ts   = get_db_last_timestamp(SatelliteTelemetry, 'satellite_id', device_id)

    saved = 0
    for rec in records:
        ts = parse_timestamp(
            rec.get('timestamp') or rec.get('time_stamp') or rec.get('time'),
            timezone.now()
        )
        if last_ts and ts <= last_ts:
            continue

        try:
            SatelliteTelemetry.objects.create(
                timestamp=ts,
                satellite_id=rec.get('satellite_id', device_id),
                satellite_name=rec.get('satellite_name', ''),
                downlink_frequency_ghz=safe_float(rec.get('downlink_frequency_ghz')),
                uplink_frequency_ghz=safe_float(rec.get('uplink_frequency_ghz')),
                snr=safe_float(rec.get('snr')),
                modulation=rec.get('modulation', ''),
                protocol=rec.get('protocol', ''),
                latitude=safe_float(rec.get('latitude')),
                longitude=safe_float(rec.get('longitude')),
            )
            saved += 1
            last_ts = ts
        except Exception as e:
            global _TOTAL_ERRORS
            _TOTAL_ERRORS += 1
            logger.error(f"Satellite save error: {e}")

    if saved:
        logger.info(f"Satellite: saved {saved} records from {file_url}")
    _mark_saved('satellite', saved, filename)

    _last_processed_file['satellite'] = {
        "url": file_url,
        "size": size,
        "last_modified": last_modified
    }


# ─── Main ─────────────────────────────────────────────────────────────────────

def process_files_once(logger):
    process_cellular_passive(logger)
    process_cellular_active(logger)
    process_satellite(logger)


def cleanup_threads():
    try:
        import concurrent.futures.thread
        concurrent.futures.thread._threads_queues.clear()
    except (AttributeError, ImportError):
        pass


def main_loop():
    global _START_TIME, _TOTAL_ERRORS
    logger = setup_logging()
    setup_django()
    _START_TIME = time.time()

    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--once", action="store_true")
    args, _ = parser.parse_known_args()

    if not args.once:
        print("\033[2J\033[H", end="") # Clear screen and move cursor to top-left

    process_files_once(logger)

    if args.once:
        print(f"\n{C.GREY}--once flag: exiting.{C.RESET}")
        cleanup_threads()
        return

    render_dashboard(0)

    try:
        cycle_count = 0
        while True:
            try:
                process_files_once(logger)

                cycle_count += 1
                render_dashboard(cycle_count)

                time.sleep(POLLING_INTERVAL)
            except KeyboardInterrupt:
                print(f"\n{C.YELLOW}Stopped.{C.RESET}\n")
                logger.info("Monitor stopped by user")
                break
            except Exception as e:
                _TOTAL_ERRORS += 1
                logger.error(f"Loop error: {e}")
                render_dashboard(cycle_count)
                time.sleep(POLLING_INTERVAL)
    finally:
        cleanup_threads()


if __name__ == "__main__":
    try:
        main_loop()
    except KeyboardInterrupt:
        print(f"\n{C.YELLOW}Stopped.{C.RESET}\n")
        sys.exit(0)