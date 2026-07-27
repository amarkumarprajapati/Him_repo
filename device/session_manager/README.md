# Session Manager Module

Manages telemetry session lifecycle: create, stop, and status retrieval.

---

## Endpoints

### Create Session

```
POST /api/session/create/
```

**Request:**

```json
{
  "session_name": "EW_PATROL_SESSION",
  "operation_mode": "LF",
  "node_id": "9",
  "node_lat": 18.506145,
  "node_long": 73.856589,
  "polling_interval": 10,
  "df_system_ip": "192.168.10.11",
  "drone_detector_ip": "192.168.10.12",
  "monitoring_system_ip": "192.168.10.13",
  "cellular_active_ip": "192.168.10.14",
  "cellular_passive_ip": "192.168.10.15",
  "satellite_interception_ip": "192.168.10.16",
  "remarks": "Daily patrol session"
}
```

**Response (201):**

```json
{
  "status": "SUCCESS",
  "message": "Session created successfully",
  "data": {
    "session_id": "e9bcfae2-...",
    "session_name": "EW_PATROL_SESSION",
    "status": "RUNNING",
    "start_time": "2026-05-18 15:30:00"
  }
}
```

### Stop Session

```
POST /api/session/stop/
```

**Request:**

```json
{
  "session_id": "e9bcfae2-4489-44a8-b53d-11aa22bb33cc",
  "stop_reason": "Patrol complete"
}
```

### Get Session Status

```
GET /api/session/status/
GET /api/session/status/?session_id=<uuid>
```

Returns the latest active session, or a specific session if `session_id` is provided.

**Session status values:** `CREATED`, `RUNNING`, `STOPPED`

---

## Files

| File           | Purpose                              |
| -------------- | ------------------------------------ |
| `views.py`     | create_session, stop_session, status |
| `serializers.py`| Request/response serializers          |
| `urls.py`      | Route definitions                     |
| `tests.py`     | Smoke tests for session lifecycle   |
