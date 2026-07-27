#!/usr/bin/env bash
set -euo pipefail

# Add PostgreSQL bin to PATH on Windows if not already present
for pg_dir in "/c/Program Files/PostgreSQL"/*/bin "/C/Program Files/PostgreSQL"/*/bin; do
    if [ -d "${pg_dir}" ] && [[ ":$PATH:" != *":${pg_dir}:"* ]]; then
        export PATH="${pg_dir}:${PATH}"
    fi
done

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

print_ok()   { echo -e "${GREEN}[OK]${NC}   $1"; }
print_info() { echo -e "${YELLOW}[INFO]${NC} $1"; }
print_err()  { echo -e "${RED}[ERR]${NC}  $1"; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# --- Activate venv ---
if [ -f "${SCRIPT_DIR}/.venv/bin/activate" ]; then
    source "${SCRIPT_DIR}/.venv/bin/activate"
    PYTHON="${SCRIPT_DIR}/.venv/bin/python"
elif [ -f "${SCRIPT_DIR}/.venv/Scripts/activate" ]; then
    source "${SCRIPT_DIR}/.venv/Scripts/activate"
    PYTHON="${SCRIPT_DIR}/.venv/Scripts/python.exe"
else
    PYTHON="$(command -v python3.10 || command -v python3 || command -v python)"
    print_info "No .venv found, using system python: ${PYTHON}"
fi

# --- Load .env ---
if [ -f "${SCRIPT_DIR}/.env" ]; then
    sed -i 's/\r$//' "${SCRIPT_DIR}/.env" 2>/dev/null || true
    set -a
    source "${SCRIPT_DIR}/.env"
    set +a
    print_ok ".env loaded"
elif [ -f "${SCRIPT_DIR}/.env.example" ]; then
    print_info ".env not found, loading .env.example for defaults"
    sed -i 's/\r$//' "${SCRIPT_DIR}/.env.example" 2>/dev/null || true
    set -a
    source "${SCRIPT_DIR}/.env.example"
    set +a
fi

DB_ENGINE="${DATABASE_ENGINE:-postgresql}"

# =============================================================================
# 1. Drop / clear the database
# =============================================================================
print_info "Clearing database (engine: ${DB_ENGINE})..."

if [ "${DB_ENGINE}" = "sqlite" ]; then
    SQLITE_FILE="${SCRIPT_DIR}/${SQLITE_NAME:-db.sqlite3}"
    if [ -f "${SQLITE_FILE}" ]; then
        rm -f "${SQLITE_FILE}"
        print_ok "SQLite file removed: ${SQLITE_FILE}"
    else
        print_info "SQLite file not found, skipping"
    fi
else
    # PostgreSQL — drop and recreate
    DB_NAME="${DB_NAME:-himshravan}"
    DB_USER="${DB_USER:-postgres}"
    DB_PASSWORD="${DB_PASSWORD:-}"
    DB_HOST="${DB_HOST:-localhost}"
    DB_PORT="${DB_PORT:-5432}"
    PG_ADMIN_USER="${PG_ADMIN_USER:-postgres}"
    PG_ADMIN_PASSWORD="${PG_ADMIN_PASSWORD:-postgres}"

    run_admin_sql() {
        local sql="$1"

        # Try with sudo first (works for local peer authentication on Linux)
        if command -v sudo >/dev/null 2>&1; then
            sudo -u postgres psql -d postgres -v ON_ERROR_STOP=1 -c "${sql}" >/dev/null 2>&1
            if [ $? -eq 0 ]; then
                return 0
            fi
        fi

        # Try with password if set
        if [ -n "${PG_ADMIN_PASSWORD}" ]; then
            PGPASSWORD="${PG_ADMIN_PASSWORD}" psql \
                -h "${DB_HOST}" -p "${DB_PORT}" -U "${PG_ADMIN_USER}" -d postgres \
                -v ON_ERROR_STOP=1 -c "${sql}" >/dev/null 2>&1
            if [ $? -eq 0 ]; then
                return 0
            fi
        fi

        # Try without password as fallback
        psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${PG_ADMIN_USER}" -d postgres \
            -v ON_ERROR_STOP=1 -c "${sql}" >/dev/null 2>&1
    }

    ESC_DB_USER="${DB_USER//\'/\'\'}"
    ESC_DB_PASSWORD="${DB_PASSWORD//\'/\'\'}"

    print_info "Ensuring PostgreSQL role '${DB_USER}' exists..."
    run_admin_sql "DO \$\$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='${ESC_DB_USER}') THEN CREATE ROLE \"${DB_USER}\" LOGIN PASSWORD '${ESC_DB_PASSWORD}'; ELSE ALTER ROLE \"${DB_USER}\" WITH LOGIN PASSWORD '${ESC_DB_PASSWORD}'; END IF; END \$\$;" \
        || { print_err "Could not create/update role '${DB_USER}'. Set PG_ADMIN_USER/PG_ADMIN_PASSWORD or run with sudo access to postgres."; exit 1; }

    print_info "Terminating active connections for '${DB_NAME}'..."
    run_admin_sql "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='${DB_NAME}' AND pid <> pg_backend_pid();" || true

    print_info "Dropping PostgreSQL database '${DB_NAME}'..."
    run_admin_sql "DROP DATABASE IF EXISTS \"${DB_NAME}\";" \
        || { print_err "Could not drop DB. Set PG_ADMIN_USER/PG_ADMIN_PASSWORD or run with sudo access to postgres."; exit 1; }

    print_info "Creating PostgreSQL database '${DB_NAME}'..."
    run_admin_sql "CREATE DATABASE \"${DB_NAME}\" OWNER \"${DB_USER}\";" \
        || { print_err "Could not create DB."; exit 1; }

    run_admin_sql "GRANT ALL PRIVILEGES ON DATABASE \"${DB_NAME}\" TO \"${DB_USER}\";" || true
    print_ok "PostgreSQL database '${DB_NAME}' recreated"
fi

# =============================================================================
# 2. Remove all migration files (keep __init__.py)
# =============================================================================
print_info "Removing old migration files..."
find "${SCRIPT_DIR}" -path "*/migrations/*.py" ! -name "__init__.py" \
    -not -path "*/.venv/*" -delete 2>/dev/null || true
find "${SCRIPT_DIR}" -path "*/migrations/__pycache__" -type d \
    -not -path "*/.venv/*" -exec rm -rf {} + 2>/dev/null || true
print_ok "Migration files cleared"

# =============================================================================
# 3. Make fresh migrations for all apps
# =============================================================================
print_info "Creating fresh migrations..."
"${PYTHON}" "${SCRIPT_DIR}/manage.py" makemigrations --noinput
print_ok "Migrations created"

# =============================================================================
# 4. Apply migrations
# =============================================================================
print_info "Applying migrations..."
"${PYTHON}" "${SCRIPT_DIR}/manage.py" migrate --noinput
print_ok "Migrations applied"

# =============================================================================
# 5. Create superuser from env (non-interactive)
# =============================================================================
SU_USER="${DJANGO_SUPERUSER_USERNAME:-admin}"
SU_PASS="${DJANGO_SUPERUSER_PASSWORD:-Admin@123}"
SU_EMAIL="${DJANGO_SUPERUSER_EMAIL:-admin@example.com}"

print_info "Creating superuser '${SU_USER}'..."
"${PYTHON}" "${SCRIPT_DIR}/manage.py" shell -c "
from authentication.models import User
if not User.objects.filter(username='${SU_USER}').exists():
    User.objects.create_superuser(
        username='${SU_USER}',
        email='${SU_EMAIL}',
        password='${SU_PASS}',
        role='SUPER_ADMIN',
    )
    print('Superuser created')
else:
    print('Superuser already exists')
"
print_ok "Superuser ready: ${SU_USER}"

echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}  Fresh reset complete!  Run: bash bootstrap.sh${NC}"
echo -e "${GREEN}============================================${NC}"
