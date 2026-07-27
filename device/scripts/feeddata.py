#!/usr/bin/env python
import os
import sys
import django

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from device.models import DeviceInfo


def seed_all_devices():
    DeviceInfo.objects.all().delete()

    devices = [
        # DF devices
        {
            "device_type": "DF",
            "ip_address": "192.168.0.9",
            "port": 8081,
            "node_id": "DF-NODE-01",
            "node_name": "DF Unit Alpha",
            "latitude": 28.6139,
            "longitude": 77.2090,
            "operating_status": "MASTER",
            "heartbeat_status": "ACTIVE",
            "network_status": "ONLINE",
            "status": "active",
            "csvrunning_status": 1,
            "station_name": "mumbai",
            "quard_id": DeviceInfo.QUARD_MUMBAI,
        },
        {
            "device_type": "DF",
            "ip_address": "192.168.0.9",
            "port": 8081,
            "node_id": "DF-NODE-02",
            "node_name": "DF Unit Beta",
            "latitude": 28.7041,
            "longitude": 77.1025,
            "operating_status": "REMOTE",
            "heartbeat_status": "ACTIVE",
            "network_status": "ONLINE",
            "status": "active",
            "csvrunning_status": 0,
            "station_name": "mumbai",
            "quard_id": DeviceInfo.QUARD_MUMBAI,
        },
        {
            "device_type": "DF",
            "ip_address": "192.168.0.6",
            "port": 8081,
            "node_id": "DF-NODE-03",
            "node_name": "DF Unit Gamma",
            "latitude": 28.5355,
            "longitude": 77.3910,
            "operating_status": "MASTER",
            "heartbeat_status": "ACTIVE",
            "network_status": "ONLINE",
            "status": "active",
            "csvrunning_status": 1,
            "station_name": "mumbai",
            "quard_id": DeviceInfo.QUARD_MUMBAI,
        },
        {
            "device_type": "DF",
            "ip_address": "192.168.0.6",
            "port": 8081,
            "node_id": "DF-NODE-04",
            "node_name": "DF Unit Delta",
            "latitude": 28.4595,
            "longitude": 77.0266,
            "operating_status": "REMOTE",
            "heartbeat_status": "INACTIVE",
            "network_status": "OFFLINE",
            "status": "inactive",
            "csvrunning_status": 0,
            "station_name": "mumbai",
            "quard_id": DeviceInfo.QUARD_MUMBAI,
        },
        # DRONE devices
        {
            "device_type": "DRONE",
            "ip_address": "192.168.0.9",
            "port": 8082,
            "node_id": "DRONE-NODE-01",
            "node_name": "Drone Unit 1",
            "latitude": 28.6200,
            "longitude": 77.2100,
            "operating_status": "MASTER",
            "heartbeat_status": "ACTIVE",
            "network_status": "ONLINE",
            "status": "active",
            "csvrunning_status": 1,
            "station_name": "pune",
            "quard_id": DeviceInfo.QUARD_PUNE,
        },
        {
            "device_type": "DRONE",
            "ip_address": "192.168.0.6",
            "port": 8082,
            "node_id": "DRONE-NODE-02",
            "node_name": "Drone Unit 2",
            "latitude": 28.6300,
            "longitude": 77.2200,
            "operating_status": "REMOTE",
            "heartbeat_status": "ACTIVE",
            "network_status": "ONLINE",
            "status": "active",
            "csvrunning_status": 0,
            "station_name": "pune",
            "quard_id": DeviceInfo.QUARD_PUNE,
        },
        # MONITORING_SENSOR device
        {
            "device_type": "MONITORING_SENSOR",
            "ip_address": "192.168.0.9",
            "port": 8080,
            "node_id": "MS-NODE-01",
            "node_name": "Monitor Sensor 1",
            "latitude": 28.6139,
            "longitude": 77.2090,
            "operating_status": "MASTER",
            "heartbeat_status": "ACTIVE",
            "network_status": "ONLINE",
            "status": "active",
            "csvrunning_status": 1,
            "station_name": "pune",
            "quard_id": DeviceInfo.QUARD_PUNE,
        },
    ]

    for dev in devices:
        DeviceInfo.objects.create(**dev)

    print(f"Seeded {len(devices)} devices:")
    for dtype in ["DF", "DRONE", "MONITORING_SENSOR"]:
        count = sum(1 for d in devices if d["device_type"] == dtype)
        print(f"  {dtype}: {count}")


if __name__ == "__main__":
    seed_all_devices()
