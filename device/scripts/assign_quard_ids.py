#!/usr/bin/env python
"""
Assign quard_id to existing sensor devices only (DF, DRONE, MONITORING_SENSOR).

Per region:
  - 2 x DF
  - 1 x DRONE
  - 1 x MONITORING_SENSOR

Does not create new rows. Only updates quard_id on devices that exist
and are not yet assigned to a quard.
"""
import os
import sys

import django

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
django.setup()

from device.models import DeviceInfo

REGION_QUARD_IDS = [DeviceInfo.QUARD_MUMBAI, DeviceInfo.QUARD_PUNE]

PER_REGION_COUNTS = [
    (DeviceInfo.DEVICE_DF, 2),
    (DeviceInfo.DEVICE_DRONE, 1),
    (DeviceInfo.DEVICE_MONITORING, 1),
]


def assign_quard_ids():
    total_updated = 0

    for quard_id in REGION_QUARD_IDS:
        quard_name = DeviceInfo.QUARD_NAMES.get(quard_id, f"Quard {quard_id}")
        print(f"\n=== {quard_name} (quard_id={quard_id}) ===")

        for device_type, needed in PER_REGION_COUNTS:
            available = list(
                DeviceInfo.objects.filter(
                    device_type=device_type,
                    quard_id__isnull=True,
                ).order_by("created_at")
            )

            if len(available) < needed:
                print(
                    f"  SKIP {device_type}: need {needed}, found {len(available)} unassigned"
                )
                continue

            selected = available[:needed]
            for device in selected:
                device.quard_id = quard_id
                device.save(update_fields=["quard_id", "updated_at"])
                total_updated += 1
                print(
                    f"  SET {device_type} {device.device_id} -> quard_id={quard_id}"
                )

    print(f"\nDone. Updated {total_updated} device(s).")


if __name__ == "__main__":
    assign_quard_ids()
