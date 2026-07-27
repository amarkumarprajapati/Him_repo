from __future__ import annotations

import asyncio
import logging
from datetime import datetime

import requests

from .config import DF_TELEMETRY_URL, HEARTBEAT_INTERVAL, POLL_INTERVAL
from .csv_writer import flush_all, get_csv_dir, write_csv_rows
from .heartbeat import is_df_reachable

logger = logging.getLogger(__name__)

_current_csv_path = None

DF_CSV_FIELDS = [
    "received_at",
    "session_id",
    "node_id",
    "master_lat",
    "master_long",
    "time_stamp",
    "target_lat",
    "target_long",
    "frequency",
    "bandwidth",
    "power_dbm",
    "Action",
]

EXTRACT_KEYS = {
    "node_id", "master_lat", "master_long", "time_stamp",
    "target_lat", "target_long", "frequency", "bandwidth", "power_dbm", "Action",
}


def _extract(item: dict) -> dict:
    return {k: item[k] for k in EXTRACT_KEYS if k in item}


def _get_or_create_df_session():
    from telemetry.models import TelemetrySession

    session = TelemetrySession.objects.filter(status=TelemetrySession.STATUS_RUNNING).first()
    if session:
        return session
    return TelemetrySession.objects.create(
        session_name="auto_df",
        operation_mode="DF",
        session_type="Auto",
        node_id="DF",
        polling_interval=10,
        status=TelemetrySession.STATUS_RUNNING,
        created_by="system",
        remarks="Auto-created by background DF poller",
    )


def _build_db_objects(session, items):
    from django.utils import timezone

    from telemetry.models import DFTelemetry

    objects = []
    for raw in items:
        d = _extract(raw)
        objects.append(
            DFTelemetry(
                session=session,
                node_id=d.get("node_id", "unknown"),
                master_lat=d.get("master_lat"),
                master_long=d.get("master_long"),
                time_stamp=d.get("time_stamp") or timezone.now(),
                target_lat=d.get("target_lat"),
                target_long=d.get("target_long"),
                frequency=d.get("frequency"),
                bandwidth=d.get("bandwidth"),
                power_dbm=d.get("power_dbm"),
                Action=d.get("Action"),
            )
        )
    return objects


def _build_csv_rows(session_id: str, items: list[dict], master_lat: float = None, master_long: float = None, node_count: int = 0) -> list[dict]:
    now = datetime.utcnow().isoformat()
    rows = []

    # Header row with session info
    header_row = {
        "received_at": now,
        "session_id": session_id,
        "node_id": f"HEADER_{node_count}",
        "master_lat": master_lat,
        "master_long": master_long,
        "time_stamp": "",
        "target_lat": "",
        "target_long": "",
        "frequency": "",
        "bandwidth": "",
        "power_dbm": "",
        "Action": "",
    }
    rows.append(header_row)

    # Data rows
    for raw in items:
        d = _extract(raw)
        rows.append(
            {
                "received_at": now,
                "session_id": session_id,
                "node_id": d.get("node_id", "unknown"),
                "master_lat": d.get("master_lat"),
                "master_long": d.get("master_long"),
                "time_stamp": d.get("time_stamp", ""),
                "target_lat": d.get("target_lat"),
                "target_long": d.get("target_long"),
                "frequency": d.get("frequency"),
                "bandwidth": d.get("bandwidth"),
                "power_dbm": d.get("power_dbm"),
                "Action": d.get("Action"),
            }
        )
    return rows


async def _poll_and_store(csv_path) -> None:
    try:
        resp = await asyncio.to_thread(requests.get, DF_TELEMETRY_URL, timeout=POLL_INTERVAL)
    except requests.exceptions.Timeout:
        logger.debug("DF telemetry poll timed out")
        return
    except requests.exceptions.ConnectionError:
        logger.debug("DF telemetry connection error")
        return

    if resp.status_code != 200:
        return

    resp_data = resp.json()
    telemetry_list = resp_data.get("telemetry", [])
    if not isinstance(telemetry_list, list):
        telemetry_list = [telemetry_list]
    if not telemetry_list:
        return

    from telemetry.models import DFTelemetry
    from device.models import DeviceInfo

    # Get all DF devices for node count
    all_df_devices = await asyncio.to_thread(
        lambda: list(DeviceInfo.objects.filter(device_type=DeviceInfo.DEVICE_DF))
    )
    node_count = len(all_df_devices)

    # Filter for MASTER devices only
    master_devices = await asyncio.to_thread(
        lambda: list(DeviceInfo.objects.filter(
            device_type=DeviceInfo.DEVICE_DF,
            operating_status=DeviceInfo.OPERATING_MASTER
        ))
    )

    if not master_devices:
        logger.debug("No MASTER DF devices found, skipping CSV generation")
        return

    master_device = master_devices[0]
    master_lat = master_device.latitude
    master_long = master_device.longitude

    session = await asyncio.to_thread(_get_or_create_df_session)
    session_id = str(session.session_id)

    db_objects = _build_db_objects(session, telemetry_list)
    try:
        await asyncio.to_thread(
            DFTelemetry.objects.bulk_create, db_objects, ignore_conflicts=True
        )
    except Exception:
        logger.exception("Failed to bulk-write %s DF records to DB", len(db_objects))
        return

    csv_rows = _build_csv_rows(session_id, telemetry_list, master_lat, master_long, node_count)
    write_csv_rows(csv_path, DF_CSV_FIELDS, csv_rows)
    logger.debug("Wrote %s DF record(s) to DB+CSV for MASTER device", len(telemetry_list))


async def df_poller() -> None:
    global _current_csv_path
    while True:
        if not is_df_reachable():
            if _current_csv_path is not None:
                flush_all()
                logger.info("DF disconnected. Closing CSV: %s", _current_csv_path)
                _current_csv_path = None
            await asyncio.sleep(1)
            continue

        if _current_csv_path is None:
            ts = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
            _current_csv_path = get_csv_dir() / "df_csv" / f"df_telemetry_{ts}.csv"
            logger.info("DF connected. New CSV: %s", _current_csv_path)

        try:
            await _poll_and_store(_current_csv_path)
        except Exception as exc:
            logger.error("DF poll unexpected error: %s", exc)

        await asyncio.sleep(HEARTBEAT_INTERVAL)
