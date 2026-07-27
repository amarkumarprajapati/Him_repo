# Events Module

Event logging for EW subsystem threats and system events with acknowledgement support.

---

## Endpoints

### List Events

```
GET /api/events/
GET /api/events/?severity=CRITICAL&subsystem_type=DF&acknowledged=false&session_id=<uuid>
```

**Query parameters:**
- `severity` — `CRITICAL`, `HIGH`, `MEDIUM`, `LOW`, `INFORMATIONAL`
- `subsystem_type` — `DF`, `MONITORING`, `DRONE`, `SATELLITE`, `PASSIVE_CELLULAR`, `ACTIVE_CELLULAR`, `SYSTEM`
- `event_type` — `RF_THREAT`, `DRONE_THREAT`, `COMMUNICATION_LOSS`, etc.
- `acknowledged` — `true` / `false`
- `session_id` — filter by session UUID

### Acknowledge Event

```
POST /api/events/acknowledge/
```

**Request:**

```json
{
  "event_id": 42,
  "acknowledged_by": "admin"
}
```

---

## Severity Levels

| Severity        | UI Color |
| --------------- | -------- |
| `CRITICAL`      | Red      |
| `HIGH`          | Orange   |
| `MEDIUM`        | Yellow   |
| `LOW`           | Blue     |
| `INFORMATIONAL` | Green    |

---

## Files

| File           | Purpose                      |
| -------------- | ---------------------------- |
| `models.py`    | EventLog model               |
| `views.py`     | EventListView, acknowledge   |
| `serializers.py`| EventLog, Acknowledge serializers |
| `urls.py`      | Route definitions            |
| `tests.py`     | Smoke tests                  |
