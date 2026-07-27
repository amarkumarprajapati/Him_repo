# Himshravan V1 — EWCPS Backend

Backend for the **Himshravan V1 / Electronic Warfare Command Post System (EWCPS)**.
Implements the API contract from `Himshravan_V1_API_routes_with_schema.doc`:
authentication, session management, device discovery (`device_info`), telemetry
ingestion for the six EW subsystems, synchronization & CSV export, event logging,
reports, and notifications.

> **Stack:** Django 4.2 · Django REST Framework · SimpleJWT · drf-spectacular · PostgreSQL/SQLite

---

## 1. Project Layout

```
core/                 Django project (settings, urls, wsgi/asgi, response, pagination)
authentication/       JWT login / refresh / logout — 3 roles (doc §13, §19)
session_manager/      Telemetry session lifecycle — create / stop / status (doc §14)
device/               Device discovery & inventory — register / status (doc §10.2, §15)
telemetry/            Six EW telemetry tables + heartbeat (doc §10.5, §16, §17)
synchronization/      sync start / export / status by device type (doc §20)
events/               event_log + acknowledgement (doc §10.5.8, §21.5–§21.6)
reports/              Statistical / analytical reports + CSV export (doc §11, §18)
notifications/        System notifications (list / detail / mark read)
exports/              CSV files written by sync/export and export/csv
logs/                 django.log
```

## 2. API Endpoints

### Authentication

| Method | Endpoint              | Description                |
| ------ | --------------------- | -------------------------- |
| POST   | `/api/auth/login/`    | JWT login (returns tokens) |
| POST   | `/api/auth/refresh/`  | Refresh access token       |
| POST   | `/api/auth/logout/`   | Blacklist refresh token    |

### Session Management

| Method | Endpoint                | Description                    |
| ------ | ----------------------- | ------------------------------ |
| POST   | `/api/session/create/`  | Create a telemetry session     |
| POST   | `/api/session/stop/`    | Stop an active session         |
| GET    | `/api/session/status/`  | Get current/specific session   |

### Device Discovery

| Method | Endpoint                            | Description              |
| ------ | ----------------------------------- | ------------------------ |
| POST   | `/api/device/register/`             | Register a new device    |
| GET    | `/api/device/status/<node_id>/`     | Get device status        |

### Heartbeat

| Method | Endpoint                    | Description              |
| ------ | --------------------------- | ------------------------ |
| POST   | `/api/v1/heartbeat/check/`  | Check subsystem health   |

### Telemetry (6 Subsystems)

| Subsystem          | Store (POST)                            | Retrieve (GET)                                              |
| ------------------ | --------------------------------------- | ----------------------------------------------------------- |
| Direction Finding  | `POST /api/telemetry/df/`               | `GET /api/telemetry/df/<node_id>/`                          |
| RF Monitoring      | `POST /api/telemetry/monitoring/`       | `GET /api/telemetry/monitoring/<node_id>/`                  |
| Drone Surveillance | `POST /api/telemetry/drone/`            | `GET /api/telemetry/drone/<drone_id>/`                      |
| Cellular Active    | `POST /api/telemetry/cellular-active/`  | `GET /api/telemetry/cellular-active/<active_cellular_id>/`  |
| Cellular Passive   | `POST /api/telemetry/cellular-passive/` | `GET /api/telemetry/cellular-passive/<passive_cellular_id>/`|
| Satellite          | `POST /api/telemetry/satellite/`        | `GET /api/telemetry/satellite/<satellite_id>/`              |

### Synchronization

| Method | Endpoint                                              | Description                     |
| ------ | ----------------------------------------------------- | ------------------------------- |
| POST   | `/api/sync/start/`                                    | Start synchronization           |
| POST   | `/api/sync/export/`                                   | Export synchronized CSV         |
| GET    | `/api/sync/status/`                                   | Sync status overview            |
| GET    | `/api/sync/status/node/<node_id>/`                    | Sync status by node             |
| GET    | `/api/sync/status/drone/<drone_id>/`                  | Sync status by drone            |
| GET    | `/api/sync/status/satellite/<satellite_id>/`          | Sync status by satellite        |
| GET    | `/api/sync/status/passive-cellular/<id>/`             | Sync status by passive cellular |
| GET    | `/api/sync/status/active-cellular/<id>/`              | Sync status by active cellular  |

### Events

| Method | Endpoint                     | Description             |
| ------ | ---------------------------- | ----------------------- |
| GET    | `/api/events/`               | List events (filtered)  |
| POST   | `/api/events/acknowledge/`   | Acknowledge an event    |

### Reports

| Method | Endpoint                      | Description             |
| ------ | ----------------------------- | ----------------------- |
| GET    | `/api/reports/statistical/`   | Counts per subsystem    |
| GET    | `/api/reports/analysis/`      | Min/max/avg aggregates  |
| POST   | `/api/export/csv/`            | CSV export              |

### Notifications

| Method | Endpoint                                  | Description              |
| ------ | ----------------------------------------- | ------------------------ |
| GET    | `/api/notifications/`                     | List notifications       |
| GET    | `/api/notifications/<id>/`                | Notification detail      |
| POST   | `/api/notifications/<id>/read/`           | Mark as read             |
| POST   | `/api/notifications/mark-all-read/`       | Mark all as read         |

## 3. Roles (doc §19)

| Role               | Access                                     |
| ------------------ | ------------------------------------------ |
| `SUPER_ADMIN`      | Full access (admin + all telemetry + RBAC) |
| `COMMAND_OPERATOR` | Monitoring + Reports                       |
| `FIELD_OPERATOR`   | Node-specific access                       |

A data migration translates legacy roles automatically:
`admin → SUPER_ADMIN`, `operator → COMMAND_OPERATOR`, `viewer → FIELD_OPERATOR`.

## 4. Quick Start (Development)

### Linux / Ubuntu

```bash
./bootstrap.sh
source .venv/bin/activate
export DEBUG=True DATABASE_ENGINE=sqlite
python manage.py migrate
python manage.py seed_data          # optional: populate demo data
python manage.py createsuperuser
python manage.py runserver 0.0.0.0:8000
```

**Open in browser:**
- `http://localhost:8000/api/docs/` — Scalar interactive API reference
- `http://localhost:8000/api/schema/` — Raw OpenAPI schema (JSON)
- `http://localhost:8000/admin/` — Django admin panel

## 5. Environment Variables

Copy `.env.example` to `.env` and adjust:

```dotenv
DEBUG=False
SECRET_KEY=change-me
ALLOWED_HOSTS=localhost,127.0.0.1
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173

DATABASE_ENGINE=postgresql        # or "sqlite"
DB_NAME=himshravan
DB_USER=himshravan
DB_PASSWORD=...
DB_HOST=localhost
DB_PORT=5432

PORT=8000
GUNICORN_WORKERS=4
HIMSHRAVAN_SYNC_MAX_RETRIES=4
```

## 6. Tests

```bash
python manage.py test
```

The smoke suite covers: auth login/logout, session lifecycle, DF & Drone telemetry
POST/GET round-trips, sync status by `node_id`, event listing, CSV export, and
heartbeat.

## 7. Database Design (doc §10)

All telemetry tables reference `device_info.device_id` (FK) and
`telemetry_session.session_id` (FK). The `sync_status` table also references
`device_info.device_id` and tracks per-subsystem synchronization & retry lifecycle
(`PENDING_RETRY → RETRYING → SENT_ON_RETRY` / `FAILED_MAX_RETRIES`) with backoff
intervals from `HIMSHRAVAN_SYNC` settings (`5 → 10 → 30 → 60 s`, doc §20.3).

## 8. Standard Response Shape

```jsonc
// success
{ "status": "SUCCESS", "message": "...", "data": { ... } }

// paginated
{ "status": "SUCCESS", "count": 100, "next": "...", "previous": null, "results": [ ] }

// failure (doc §21.4)
{
  "status": "FAILED",
  "error_code": "REMOTE_NODE_UNREACHABLE",
  "message": "Unable to reach subsystem node",
  "subsystem": "DF_SYSTEM",
  "node_id": "DF_NODE_001",
  "timestamp": "2026-03-03T23:47:15Z"
}
```

## 9. Management Commands

| Command                          | Description                                 |
| -------------------------------- | ------------------------------------------- |
| `python manage.py seed_data`     | Seed demo sessions, telemetry, and devices  |
| `python manage.py export_telemetry_csv` | Export telemetry data to CSV file    |
| `python manage.py archive_telemetry`    | Archive old telemetry records        |

## 10. Quality Gate (CI / Pre-Push Checks)

Before every push, the following checks must pass. They run automatically via git hooks and GitHub Actions.

### Quick Check (run before pushing)

**Linux / Ubuntu:**

```bash
./scripts/check.sh
# Auto-fix issues:
./scripts/check.sh --fix
```

### What Gets Checked

| Step | Tool | What it does |
| ---- | ---- | ------------ |
| 1 | `ruff check .` | Linting (pycodestyle, pyflakes, isort, bugbear, Django rules) |
| 2 | `ruff format --check .` | Code formatting consistency |
| 3 | `makemigrations --check --dry-run` | Ensures all model changes have migrations committed |
| 4 | `python manage.py test` | Full Django test suite (59+ tests) |

### Git Hooks

Install once after cloning:

```bash
./scripts/install-hooks.sh
```

This configures:
- **Pre-commit hook** — runs ruff on staged Python files before allowing a commit
- **Pre-push hook** — runs full quality gate (ruff + migrations + tests) before allowing a push

> **Emergency bypass:** `git commit --no-verify` or `git push --no-verify`

### GitHub Actions CI

Every push to any branch and every PR to `main` triggers the CI pipeline (`.github/workflows/ci.yml`).
It runs the same 4 steps in an Ubuntu environment with PostgreSQL.

---

## 11. Deployment

See [`DEPLOYMENT.md`](DEPLOYMENT.md) for production deploy with gunicorn + nginx
+ PostgreSQL.

## 12. Frontend Integration

See **[`FRONTEND_INTEGRATION.md`](FRONTEND_INTEGRATION.md)** for the complete
frontend integration guide with:

- Authentication flow (login / refresh / logout) with code examples
- Request/response payloads for every endpoint
- Axios interceptor setup for auto token refresh
- Error handling patterns
- CORS configuration
- Severity color mapping for event UI
- Full endpoint quick-reference table

<!-- python3 ./scripts/heartbeat_checker.py -->
<!-- powershell -ExecutionPolicy Bypass -File bootstrap-windows.ps1 -->
<!-- .venv\Scripts\python.exe manage.py migrate telemetry 0003 --fake -->
<!-- source .venv/bin/activate -->
<!-- python3 ./scripts/cognent/Filecheck.py -->
<!-- python3 ./scripts/cognent/cellular_satelliite_info.py -->
<!-- SELECT device_type,status,telemetry_timestamp FROM device_info;-->
<!-- SELECT * FROM cellular_active_telemetry; -->