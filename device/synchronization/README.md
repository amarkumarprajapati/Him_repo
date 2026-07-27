# Synchronization Module

Handles synchronization lifecycle, CSV export, and sync status tracking for
telemetry data across all six EW subsystems.

> This module does not define its own models — it reuses `telemetry.SyncStatus`.

---

## Endpoints

### Start Sync

```
POST /api/sync/start/
```

Initiates or updates a synchronization record for a `(session, subsystem, device)` triple.

**Request:**

```json
{
  "session_id": "e9bcfae2-4489-44a8-b53d-11aa22bb33cc",
  "subsystem_type": "DF",
  "device_reference_id": "DF_NODE_001",
  "polling_interval": 10,
  "destination_ip": "192.168.20.10"
}
```

**Response (202):**

```json
{
  "status": "SUCCESS",
  "message": "Synchronization started",
  "data": {
    "session_id": "e9bcfae2-...",
    "subsystem_type": "DF",
    "device_reference_id": "DF_NODE_001",
    "sync_status": "IN_PROGRESS",
    "polling_interval": 10,
    "destination_ip": "192.168.20.10"
  }
}
```

### Export CSV

```
POST /api/sync/export/
```

Exports telemetry data for a given session and module to a CSV file.

**Request:**

```json
{
  "session_id": "e9bcfae2-4489-44a8-b53d-11aa22bb33cc",
  "module": "DRONE",
  "selected_fields": ["drone_id", "drone_status", "drone_latitude", "drone_longitude"],
  "destination_ip": "192.168.20.10"
}
```

**Response (200):**

```json
{
  "status": "SUCCESS",
  "message": "CSV export completed successfully",
  "data": {
    "csv_file_name": "drone_e9bcfae2_20260518_153500.csv",
    "download_url": "/exports/drone_e9bcfae2_20260518_153500.csv",
    "exported_records": 42,
    "destination_ip": "192.168.20.10"
  }
}
```

**Modules:** `DF`, `MONITORING`, `DRONE`, `CELLULAR_ACTIVE`, `CELLULAR_PASSIVE`, `SATELLITE`

### Sync Status Overview

```
GET /api/sync/status/
GET /api/sync/status/?session_id=<uuid>&subsystem_type=DF
```

Returns the 200 most recent sync records, optionally filtered by `session_id` and `subsystem_type`.

### Sync Status by Device

| Endpoint                                              | Description                     |
| ----------------------------------------------------- | ------------------------------- |
| `GET /api/sync/status/node/<node_id>/`                | Node status (DF / Monitoring)   |
| `GET /api/sync/status/drone/<drone_id>/`              | Drone status                    |
| `GET /api/sync/status/satellite/<satellite_id>/`      | Satellite status                |
| `GET /api/sync/status/passive-cellular/<id>/`          | Passive cellular status         |
| `GET /api/sync/status/active-cellular/<id>/`          | Active cellular status          |

**Sync status values:** `PENDING`, `IN_PROGRESS`, `COMPLETED`, `FAILED`, `PENDING_RETRY`, `RETRYING`, `FAILED_MAX_RETRIES`, `SENT_ON_RETRY`, `SUCCESS`

---

## Files

| File            | Purpose                                  |
| --------------- | ---------------------------------------- |
| `views.py`      | API views: start, export, status helpers |
| `serializers.py`| SyncStatusDetail, SyncStart, SyncExport  |
| `urls.py`       | Route definitions                        |
| `models.py`     | Empty — reuses `telemetry.SyncStatus`  |
| `tests.py`      | Smoke tests for all sync endpoints       |
