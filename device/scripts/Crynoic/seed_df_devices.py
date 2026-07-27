#!/usr/bin/env python
import os
import sys
import django

# Add project root to Python path (scripts/Crynoic/ -> project root)
script_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(os.path.dirname(script_dir))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from device.models import DeviceInfo

def seed_df_devices():
    DeviceInfo.objects.all().delete()

    devices = [
        {"device_type": "DF", "ip_address": "192.168.0.9", "port": 8081},
        {"device_type": "DF", "ip_address": "192.168.0.9", "port": 8081},
        {"device_type": "DF", "ip_address": "192.168.0.6", "port": 8081},
        {"device_type": "DF", "ip_address": "192.168.0.6", "port": 8081},
        {"device_type": "DRONE", "ip_address": "192.168.0.9", "port": 8082},
        {"device_type": "DRONE", "ip_address": "192.168.0.6", "port": 8082},
        {"device_type": "MONITORING_SENSOR", "ip_address": "192.168.0.9", "port": 8080},
    ]

    for dev in devices:
        DeviceInfo.objects.create(**dev)

    print(f"Seeded {len(devices)} DF devices")

if __name__ == "__main__":
    seed_df_devices()