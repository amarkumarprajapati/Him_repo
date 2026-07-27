from __future__ import annotations

import asyncio
import logging
import threading

import requests

from .config import (
    DF_HEALTH_URL,
    DRONE_HEALTH_URL,
    HEALTH_ENDPOINTS,
    HEARTBEAT_INTERVAL,
    MONITORING_HEALTH_URL,
)

logger = logging.getLogger(__name__)

_drone_reachable = False
_monitoring_reachable = False
_df_reachable = False
_reachability_lock = threading.Lock()


async def _check_health(url: str) -> dict | None:
    try:
        resp = await asyncio.to_thread(requests.get, url, timeout=5)
        if resp.status_code == 200:
            return resp.json()
    except Exception:
        pass
    return None


def _store_device(health_data: dict, endpoint: dict) -> None:
    try:
        from device.models import DeviceInfo

        ip = health_data.get("ip_address")
        device_type = health_data.get("device_type") or endpoint.get("device_type", "NODE")
        node_id = ip or "unknown"
        DeviceInfo.objects.update_or_create(
            node_id=node_id,
            defaults={
                "device_type": device_type,
                "ip_address": ip,
                "port": endpoint.get("port"),
                "heartbeat_status": DeviceInfo.HEARTBEAT_ACTIVE,
                "network_status": DeviceInfo.NETWORK_ONLINE,
            },
        )
    except Exception:
        logger.debug("Failed to store device from health endpoint %s", endpoint.get("url"))


def is_drone_reachable() -> bool:
    with _reachability_lock:
        return _drone_reachable


def is_monitoring_reachable() -> bool:
    with _reachability_lock:
        return _monitoring_reachable


def is_df_reachable() -> bool:
    with _reachability_lock:
        return _df_reachable


async def heartbeat_loop() -> None:
    global _drone_reachable, _monitoring_reachable, _df_reachable
    while True:
        for ep in HEALTH_ENDPOINTS:
            data = await _check_health(ep["url"])
            if data:
                await asyncio.to_thread(_store_device, data, ep)

        drone_data = await _check_health(DRONE_HEALTH_URL)
        monitoring_data = await _check_health(MONITORING_HEALTH_URL)
        df_data = await _check_health(DF_HEALTH_URL)

        with _reachability_lock:
            drone_ok = drone_data is not None
            monitoring_ok = monitoring_data is not None
            df_ok = df_data is not None
            if _drone_reachable != drone_ok:
                logger.info("Drone reachable: %s", drone_ok)
                _drone_reachable = drone_ok
            if _monitoring_reachable != monitoring_ok:
                logger.info("Monitoring reachable: %s", monitoring_ok)
                _monitoring_reachable = monitoring_ok
            if _df_reachable != df_ok:
                logger.info("DF reachable: %s", df_ok)
                _df_reachable = df_ok

        await asyncio.sleep(HEARTBEAT_INTERVAL)
