import os
import sys
import time
import csv
import json
import xml.etree.ElementTree as ET
import logging
from datetime import datetime
from pathlib import Path
import requests

import django


# ============================================================================
# CONFIGURATION - UPDATE THESE VALUES AS NEEDED
# ============================================================================


IP_ADDRESS = "10.26.40.199"
PORT = "4001"

FILE_PATHS = {
    "cellular_passive": f"http://{IP_ADDRESS}:{PORT}/pi2",
    "cellular_active": f"http://{IP_ADDRESS}:{PORT}/gi2",
    "satellite": f"http://{IP_ADDRESS}:{PORT}/si2",
}


DEFAULT_DEVICE_IDS = {
    "cellular_passive": "PI2",
    "cellular_active": "GI2",
    "satellite": "SI2",
}


POLLING_INTERVAL = 1
CONNECTION_CHECK_INTERVAL = 30
LOG_DIR_NAME = "logs"
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
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(os.path.dirname(script_dir))
    if project_root not in sys.path:
        sys.path.insert(0, project_root)
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
    django.setup()



_last_etag = {}
_last_modified = {}


def xml_element_to_dict(element):
    """Recursively flatten an XML element into a flat dict."""
    data = {}
    for child in element:
        if list(child):
            data.update(xml_element_to_dict(child))
        else:
            if child.text and child.text.strip():
                data[child.tag] = child.text.strip()
    return data


def http_get_content(url, logger, retries=3, timeout=5):
    """Fetch content from HTTP URL with retries."""
    last_err = None
    for attempt in range(retries):
        try:
            response = requests.get(url, timeout=timeout)
            response.raise_for_status()
            return response.text, response.headers.get('ETag'), response.headers.get('Last-Modified')
        except requests.RequestException as e:
            last_err = e
            time.sleep(0.2)
        except KeyboardInterrupt:
            raise
    logger.warning(f"Could not fetch {url} after {retries} attempts: {last_err}")
    return None, None, None


def check_http_modification(url, logger):
    """Check if HTTP resource has been modified using ETag or Last-Modified."""
    try:
        response = requests.head(url, timeout=5)
        response.raise_for_status()
        
        etag = response.headers.get('ETag')
        last_modified = response.headers.get('Last-Modified')
        
        # Check ETag first (more reliable)
        if etag:
            if etag != _last_etag.get(url):
                _last_etag[url] = etag
                return True
            return False
        
        # Fallback to Last-Modified header
        if last_modified:
            if last_modified != _last_modified.get(url):
                _last_modified[url] = last_modified
                return True
            return False
        
        # No headers available, assume changed
        return True
    except requests.RequestException as e:
        logger.error(f"HTTP HEAD request failed for {url}: {e}")
        return False
    except KeyboardInterrupt:
        raise


def parse_csv_file(url, logger):
    """Parse CSV from HTTP URL - return latest (last) row."""
    try:
        content, _, _ = http_get_content(url, logger)
        if not content:
            return None
        import io
        rows = list(csv.DictReader(io.StringIO(content)))
        if not rows:
            return None
        return rows[-1]
    except Exception as e:
        logger.error(f"CSV parse error: {e}")
        return None


def parse_xml_file(url, logger):
    """Parse XML from HTTP URL - flatten nested elements."""
    try:
        content, _, _ = http_get_content(url, logger)
        if not content:
            return None
        root = ET.fromstring(content)
        data = xml_element_to_dict(root)
        return data if data else None
    except ET.ParseError as e:
        logger.warning(f"XML parse error (may be incomplete): {e}")
        return None
    except Exception as e:
        logger.error(f"XML parse error: {e}")
        return None


def parse_json_file(url, logger):
    """Parse JSON from HTTP URL - if list, return last item."""
    try:
        content, _, _ = http_get_content(url, logger)
        if not content:
            return None
        data = json.loads(content)
        if isinstance(data, list):
            return data[-1] if data else None
        return data
    except json.JSONDecodeError as e:
        logger.warning(f"JSON parse error (may be incomplete): {e}")
        return None
    except Exception as e:
        logger.error(f"JSON parse error: {e}")
        return None


def get_db_last_timestamp(model_class, id_field, id_value):
    """Get the latest timestamp already in DB for this device."""
    try:
        last = model_class.objects.filter(**{id_field: id_value}).order_by('-timestamp').first()
        return last.timestamp if last else None
    except Exception:
        return None


def parse_timestamp(ts_str, fallback):
    """Try parsing an ISO timestamp string, fallback to provided value."""
    if ts_str:
        try:
            return datetime.fromisoformat(str(ts_str).replace('Z', '+00:00'))
        except Exception:
            pass
    return fallback


def safe_float(value):
    """Safely convert value to float, return None if conversion fails."""
    if value is None or value == '':
        return None
    try:
        return float(value)
    except (ValueError, TypeError):
        return None


def show_connection_status():
    """Show initial connection status for all HTTP endpoints."""
    print(f"{C.GREY}Checking HTTP connections...{C.RESET}\n")
    
    for key, url in FILE_PATHS.items():
        if key == 'cellular_passive':
            label = "PI2  (Cellular Passive)"
        elif key == 'cellular_active':
            label = "GI2  (Cellular Active)"
        else:
            label = "SI2  (Satellite)"
        
        try:
            response = requests.head(url, timeout=5)
            if response.status_code == 200:
                cprint("●", C.GREEN, "CONNECTED", f"{label}  [{url}]")
            else:
                cprint("✗", C.RED, f"ERROR {response.status_code}", f"{label}  [{url}]")
        except requests.RequestException as e:
            cprint("✗", C.RED, "FAILED", f"{label}  [{url}]")
        except KeyboardInterrupt:
            raise
    print()


def process_cellular_passive(logger):
    from telemetry.models import CellularPassiveTelemetry
    from django.utils import timezone

    url = FILE_PATHS['cellular_passive']

    if not check_http_modification(url, logger):
        return

    cprint("↓", C.BLUE,  "READING  ", "PI2.csv")

    data = parse_csv_file(url, logger)
    if not data:
        cprint("!", C.YELLOW, "EMPTY", "No data in PI2.csv")
        return

    device_id = data.get('passive_cellular_id', DEFAULT_DEVICE_IDS['cellular_passive'])
    ts = parse_timestamp(
        data.get('timestamp') or data.get('time_stamp') or data.get('time'),
        timezone.now()
    )

    last_ts = get_db_last_timestamp(CellularPassiveTelemetry, 'passive_cellular_id', device_id)

    if last_ts and ts <= last_ts:
        return

    try:
        CellularPassiveTelemetry.objects.create(
            timestamp=ts,
            passive_cellular_id=device_id,
            protocol=data.get('protocol', ''),
            signal_strength_dbm=safe_float(data.get('signal_strength_dbm')),
            frequency_mhz=safe_float(data.get('frequency_mhz')),
            latitude=safe_float(data.get('latitude')),
            longitude=safe_float(data.get('longitude')),
        )
        cprint("✔", C.GREEN, "SAVED    ", f"PI2 → cellular_passive_telemetry")
        logger.info(f"Saved CellularPassive: {data}")
    except Exception as e:
        cprint("✗", C.RED, "DB ERROR ", str(e))
        logger.error(f"CellularPassive save error: {e}")


def process_cellular_active(logger):
    from telemetry.models import CellularActiveTelemetry
    from django.utils import timezone

    url = FILE_PATHS['cellular_active']

    if not check_http_modification(url, logger):
        return

    cprint("↓", C.BLUE,  "READING  ", "GI2.xml")

    data = parse_xml_file(url, logger)
    if not data:
        cprint("!", C.YELLOW, "EMPTY", "No usable data in GI2.xml")
        return

    device_id = data.get('active_cellular_id', DEFAULT_DEVICE_IDS['cellular_active'])
    ts = parse_timestamp(
        data.get('timestamp') or data.get('time_stamp') or data.get('time'),
        timezone.now()
    )

    last_ts = get_db_last_timestamp(CellularActiveTelemetry, 'active_cellular_id', device_id)

    if last_ts and ts <= last_ts:
        return

    try:
        CellularActiveTelemetry.objects.create(
            timestamp=ts,
            active_cellular_id=device_id,
            imsi=data.get('imsi', ''),
            imei=data.get('imei', ''),
            operator_name=data.get('operator_name', ''),
            signal_strength_dbm=safe_float(data.get('signal_strength_dbm')),
            frequency_mhz=safe_float(data.get('frequency_mhz')),
            bandwidth_mhz=safe_float(data.get('bandwidth_mhz')),
            latitude=safe_float(data.get('latitude')),
            longitude=safe_float(data.get('longitude')),
        )
        cprint("✔", C.GREEN, "SAVED    ", f"GI2 → cellular_active_telemetry")
        logger.info(f"Saved CellularActive: {data}")
    except Exception as e:
        cprint("✗", C.RED, "DB ERROR ", str(e))
        logger.error(f"CellularActive save error: {e}")


def process_satellite(logger):
    from telemetry.models import SatelliteTelemetry
    from django.utils import timezone

    url = FILE_PATHS['satellite']

    if not check_http_modification(url, logger):
        return

    cprint("↓", C.BLUE,  "READING  ", "SI2.json")

    data = parse_json_file(url, logger)
    if not data:
        cprint("!", C.YELLOW, "EMPTY", "No usable data in SI2.json")
        return

    device_id = data.get('satellite_id', DEFAULT_DEVICE_IDS['satellite'])
    ts = parse_timestamp(
        data.get('timestamp') or data.get('time_stamp') or data.get('time'),
        timezone.now()
    )

    last_ts = get_db_last_timestamp(SatelliteTelemetry, 'satellite_id', device_id)

    if last_ts and ts <= last_ts:
        return

    try:
        SatelliteTelemetry.objects.create(
            timestamp=ts,
            satellite_id=device_id,
            satellite_name=data.get('satellite_name', ''),
            downlink_frequency_ghz=safe_float(data.get('downlink_frequency_ghz')),
            uplink_frequency_ghz=safe_float(data.get('uplink_frequency_ghz')),
            snr=safe_float(data.get('snr')),
            modulation=data.get('modulation', ''),
            protocol=data.get('protocol', ''),
            latitude=safe_float(data.get('latitude')),
            longitude=safe_float(data.get('longitude')),
        )
        cprint("✔", C.GREEN, "SAVED    ", f"SI2 → satellite_telemetry")
        logger.info(f"Saved Satellite: {data}")
    except Exception as e:
        cprint("✗", C.RED, "DB ERROR ", str(e))
        logger.error(f"Satellite save error: {e}")


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
    logger = setup_logging()
    setup_django()

    print(f"\n{C.BOLD}{C.MAGENTA}{'─'*60}{C.RESET}")
    print(f"{C.BOLD}{C.MAGENTA}  DATA FILE MONITOR  —  every {POLLING_INTERVAL}s{C.RESET}")
    print(f"{C.BOLD}{C.MAGENTA}{'─'*60}{C.RESET}\n")

    show_connection_status()

    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--once", action="store_true")
    args, _ = parser.parse_known_args()

    process_files_once(logger)

    if args.once:
        print(f"\n{C.GREY}--once flag: exiting.{C.RESET}")
        cleanup_threads()
        return

    try:
        cycle_count = 0
        while True:
            try:
                process_files_once(logger)
                
                # Periodically re-check connection status
                cycle_count += 1
                if cycle_count % CONNECTION_CHECK_INTERVAL == 0:
                    print(f"\n{C.GREY}Re-checking HTTP connections...{C.RESET}\n")
                    show_connection_status()
                
                time.sleep(POLLING_INTERVAL)
            except KeyboardInterrupt:
                print(f"\n{C.YELLOW}Stopped.{C.RESET}\n")
                logger.info("Monitor stopped by user")
                break
            except Exception as e:
                cprint("✗", C.RED, "LOOP ERR ", str(e))
                logger.error(f"Loop error: {e}")
                time.sleep(POLLING_INTERVAL)
    finally:
        cleanup_threads()


if __name__ == "__main__":
    try:
        main_loop()
    except KeyboardInterrupt:
        print(f"\n{C.YELLOW}Stopped.{C.RESET}\n")
        sys.exit(0)