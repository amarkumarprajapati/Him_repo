# Reports Module

Generates statistical reports, analytical reports, and CSV exports for telemetry data.

---

## Endpoints

### Statistical Report

```
GET /api/reports/statistical/
GET /api/reports/statistical/?session_id=<uuid>
```

Returns counts per subsystem (DF, Monitoring, Drone, Cellular Active/Passive, Satellite),
plus event and session counts.

**Response (200):**

```json
{
  "status": "SUCCESS",
  "message": "Statistical report",
  "data": {
    "DF": 120,
    "MONITORING": 85,
    "DRONE": 45,
    "CELLULAR_ACTIVE": 30,
    "CELLULAR_PASSIVE": 22,
    "SATELLITE": 18,
    "EVENTS": 7,
    "SESSIONS": 3
  }
}
```

### Analysis Report

```
GET /api/reports/analysis/
GET /api/reports/analysis/?session_id=<uuid>&module=DF
```

Returns aggregate statistics (min, max, avg) per subsystem.

**Response (200):**

```json
{
  "status": "SUCCESS",
  "message": "Analysis report",
  "data": {
    "DF": {
      "metric": "snr",
      "count": 120,
      "min": 5.2,
      "max": 45.8,
      "avg": 22.3
    }
  }
}
```

### CSV Export

```
POST /api/export/csv/
```

**Request:**

```json
{
  "session_id": "e9bcfae2-...",
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

---

## Files

| File       | Purpose                                   |
| ---------- | ----------------------------------------- |
| `views.py` | statistical_report, analysis_report, csv_export |
| `urls.py`  | Route definitions                         |
| `tests.py` | Smoke tests for reports and export        |
