# Notifications Module

System notifications for session lifecycle events, exports, alerts, and system messages.

---

## Endpoints

### List Notifications

```
GET /api/notifications/
GET /api/notifications/?category=SESSION&priority=HIGH&is_read=false
```

**Query parameters:** `category`, `status`, `priority`, `is_read`

### Get Notification Detail

```
GET /api/notifications/<notification_id>/
```

### Mark as Read

```
POST /api/notifications/<notification_id>/read/
```

### Mark All as Read

```
POST /api/notifications/mark-all-read/
POST /api/notifications/mark-all-read/?category=SESSION
```

---

## Notification Categories

| Category  | Description                        |
| --------- | ---------------------------------- |
| `SESSION` | Session created / stopped / deleted |
| `SYSTEM`  | System-level messages              |
| `EXPORT`  | Export completed / failed          |
| `ALERT`   | Critical alerts                    |

## Priority Levels

| Priority   | Description |
| ---------- | ----------- |
| `LOW`      | Low         |
| `MEDIUM`   | Medium      |
| `HIGH`     | High        |
| `CRITICAL` | Critical    |

## Status Values

| Status    | Description |
| --------- | ----------- |
| `UNREAD`  | Unread      |
| `READ`    | Read        |

---

## Files

| File           | Purpose                               |
| -------------- | ------------------------------------- |
| `models.py`    | Notification model with category/priority |
| `views.py`     | List, detail, mark read, mark all read |
| `serializers.py`| Notification serialization           |
| `urls.py`      | Route definitions                     |
| `utils.py`     | Helper to create session notifications |
| `tests.py`     | Smoke tests                           |
