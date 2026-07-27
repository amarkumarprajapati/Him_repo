# Authentication Module

JWT-based authentication with role-based access control (RBAC).

---

## Endpoints

### Login

```
POST /api/auth/login/
```

**Request:**

```json
{
  "username": "admin",
  "password": "Admin@123"
}
```

**Response (200):**

```json
{
  "status": "SUCCESS",
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "role": "SUPER_ADMIN",
  "expires_in": 3600,
  "username": "admin"
}
```

### Refresh Token

```
POST /api/auth/refresh/
```

**Request:**

```json
{
  "refresh": "<refresh_token>"
}
```

**Response (200):**

```json
{
  "access": "eyJ..."
}
```

### Logout

```
POST /api/auth/logout/
```

**Request:**

```json
{
  "refresh_token": "<refresh_token>"
}
```

**Response (200):**

```json
{
  "status": "SUCCESS",
  "message": "Logout successful"
}
```

---

## Roles

| Role                | Access                                     |
| ------------------- | ------------------------------------------ |
| `SUPER_ADMIN`       | Full access (admin + all telemetry + RBAC) |
| `COMMAND_OPERATOR`  | Monitoring + Reports                       |
| `FIELD_OPERATOR`    | Node-specific access                       |

---

## Files

| File              | Purpose                                |
| ----------------- | -------------------------------------- |
| `views.py`        | LoginView, TokenRefreshView, logout    |
| `serializers.py`  | RoleTokenObtainPairSerializer, Logout  |
| `models.py`       | Custom User model with role field      |
| `permissions.py`  | Custom DRF permission classes          |
| `urls.py`         | Route definitions                      |
| `tests.py`        | Smoke tests for auth flow              |
