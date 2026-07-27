# Device Application

The `device` app handles device discovery, registration, and status tracking for the HIMSHRAVAN backend system.

## Management Commands

### `add_dummy_devices`

You can populate the database with dummy devices for testing and development purposes.

```bash
python manage.py add_dummy_devices
```

Running this command creates a default set of dummy devices, including:
- Antennas
- Drones (e.g., Alpha, Beta, Gamma)
- Monitoring Sensors (e.g., Sensor A, Sensor B)