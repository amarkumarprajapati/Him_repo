from __future__ import annotations

BASE_IP = "10.98.41.199"

DRONE_HEALTH_URL = f"http://{BASE_IP}:9003/health"
DRONE_TELEMETRY_URL = f"http://{BASE_IP}:9003/telemetry"

MONITORING_HEALTH_URL = f"http://{BASE_IP}:9004/health"
MONITORING_WS_URL = f"ws://{BASE_IP}:9004/ch1"

DF_HEALTH_URL = f"http://{BASE_IP}:9005/health"
DF_TELEMETRY_URL = f"http://{BASE_IP}:9005/telemetry"

HEALTH_ENDPOINTS = [
    {"url": DRONE_HEALTH_URL, "port": 9003, "device_type": "DRONE"},
    {"url": MONITORING_HEALTH_URL, "port": 9004, "device_type": "NODE"},
    {"url": DF_HEALTH_URL, "port": 9005, "device_type": "NODE"},
]

HEARTBEAT_INTERVAL = 15.0
POLL_INTERVAL = 10
RECONNECT_MIN_DELAY = 1.0
RECONNECT_MAX_DELAY = 30.0

CSV_BATCH_SIZE = 50
CSV_FLUSH_INTERVAL = 5.0
