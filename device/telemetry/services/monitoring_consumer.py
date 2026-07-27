from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime

from .config import MONITORING_WS_URL, RECONNECT_MAX_DELAY, RECONNECT_MIN_DELAY
from .csv_writer import flush_all, get_csv_dir, write_csv_rows
from .heartbeat import is_monitoring_reachable

logger = logging.getLogger(__name__)

_current_csv_path = None

MONITORING_CSV_FIELDS = [
    "received_at",
    "channel",
    "device_type",
    "ip_address",
    "node_id",
    "center_frequency_hz",
    "threshold_dbm",
    "freq_mhz",
    "power_dbm",
    "protocol",
    "modulation",
    "bandwidth_3dbm_khz",
    "occupied_bandwidth_khz",
    "snr",
    "sinad",
    "thd",
    "symbol_rate",
    "timestamp",
]

EXTRACT_KEYS = {
    "node_id", "center_frequency_hz", "threshold_dbm", "freq_mhz",
    "power_dbm", "protocol", "modulation", "bandwidth_3dbm_khz",
    "occupied_bandwidth_khz", "snr", "sinad", "thd", "symbol_rate",
    "timestamp",
}

META_KEYS = {"channel", "device_type", "ip_address"}


def _extract_data(data: dict) -> dict:
    return {k: data[k] for k in EXTRACT_KEYS if k in data}


def _extract_meta(payload: dict) -> dict:
    return {k: payload.get(k, "") for k in META_KEYS}


def _build_db_object(d: dict):
    from django.utils import timezone

    from telemetry.models import MonitoringTelemetry

    return MonitoringTelemetry(
        session=None,
        device=None,
        timestamp=d.get("timestamp") or timezone.now(),
        node_id=d.get("node_id", ""),
        center_frequency_hz=d.get("center_frequency_hz"),
        threshold_dbm=d.get("threshold_dbm"),
        freq_mhz=d.get("freq_mhz"),
        power_dbm=d.get("power_dbm"),
        protocol=d.get("protocol", ""),
        modulation=d.get("modulation", ""),
        bandwidth_3dbm_khz=d.get("bandwidth_3dbm_khz"),
        occupied_bandwidth_khz=d.get("occupied_bandwidth_khz"),
        snr=d.get("snr"),
        sinad=d.get("sinad"),
        thd=d.get("thd"),
        symbol_rate=d.get("symbol_rate", ""),
    )


def _build_csv_row(meta: dict, d: dict) -> dict:
    row = {"received_at": datetime.utcnow().isoformat()}
    row.update(meta)
    row.update({k: d.get(k, "") for k in EXTRACT_KEYS})
    return row


async def _handle_message(raw: str, csv_path) -> None:
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError:
        logger.warning("Invalid JSON from monitoring websocket: %s...", raw[:200])
        return

    if not isinstance(payload, dict):
        return

    data = payload.get("data")
    if not isinstance(data, dict):
        logger.debug("Monitoring payload missing 'data' field")
        return

    d = _extract_data(data)
    meta = _extract_meta(payload)

    db_obj = _build_db_object(d)
    try:
        from telemetry.models import MonitoringTelemetry

        await asyncio.to_thread(
            MonitoringTelemetry.objects.bulk_create, [db_obj], ignore_conflicts=True
        )
    except Exception:
        logger.exception("Failed to write monitoring record to DB")
        return

    csv_row = _build_csv_row(meta, d)
    write_csv_rows(csv_path, MONITORING_CSV_FIELDS, [csv_row])
    logger.debug("Wrote monitoring record to DB+CSV")


async def monitoring_consumer() -> None:
    import websockets

    global _current_csv_path
    delay = RECONNECT_MIN_DELAY

    while True:
        if not is_monitoring_reachable():
            if _current_csv_path is not None:
                flush_all()
                logger.info("Monitoring disconnected. Closing CSV: %s", _current_csv_path)
                _current_csv_path = None
            await asyncio.sleep(1)
            delay = RECONNECT_MIN_DELAY
            continue

        if _current_csv_path is None:
            ts = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
            _current_csv_path = get_csv_dir() / "monitoring_csv" / f"monitoring_{ts}.csv"
            logger.info("Monitoring connected. New CSV: %s", _current_csv_path)

        try:
            logger.info("Connecting to monitoring websocket: %s", MONITORING_WS_URL)
            async with websockets.connect(MONITORING_WS_URL, open_timeout=10) as ws:
                logger.info("Monitoring websocket connected")
                delay = RECONNECT_MIN_DELAY

                while True:
                    if not is_monitoring_reachable():
                        logger.info("Monitoring became unreachable, closing websocket")
                        break

                    try:
                        message = await asyncio.wait_for(ws.recv(), timeout=5)
                    except asyncio.TimeoutError:
                        continue

                    if isinstance(message, str):
                        await _handle_message(message, _current_csv_path)
                    else:
                        logger.debug("Received binary message, skipping")

        except websockets.ConnectionClosed:
            logger.warning("Monitoring websocket closed")
        except websockets.InvalidURI:
            logger.error("Invalid websocket URI: %s", MONITORING_WS_URL)
            break
        except ConnectionRefusedError:
            logger.warning("Monitoring websocket connection refused, will retry")
        except TimeoutError:
            logger.debug("Monitoring websocket connect timed out")
        except OSError as exc:
            logger.warning("Monitoring websocket OS error: %s", exc)
        except Exception as exc:
            logger.error("Monitoring websocket unexpected error: %s", exc)

        await asyncio.sleep(delay)
        delay = min(delay * 2, RECONNECT_MAX_DELAY)
