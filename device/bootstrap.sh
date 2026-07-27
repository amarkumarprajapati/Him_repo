#!/usr/bin/env bash
set -euo pipefail

PORT="${PORT:-8001}"

resolve_python() {
    if [ -n "${PYTHON_BIN:-}" ]; then
        echo "$PYTHON_BIN"
        return
    fi
    command -v python3.10 2>/dev/null \
        || command -v python3 2>/dev/null \
        || command -v python
}

PYTHON_BIN="$(resolve_python)"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

check_command() {
    command -v "$1" >/dev/null 2>&1
}

print_header() {
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}      Himshravan V1 EWCPS API           ${NC}"
    echo -e "${GREEN}========================================${NC}"
}

print_ok() { echo -e "${GREEN}[OK]${NC} $1"; }
print_info() { echo -e "${YELLOW}[INFO]${NC} $1"; }
print_err() { echo -e "${RED}[ERR]${NC} $1"; }

print_header

# --- 1. Check Python ---
if ! check_command "$PYTHON_BIN"; then
    print_err "Python 3.10 is required but was not found. Install with:"
    print_err "  sudo apt install python3.10 python3.10-venv python3-pip"
    exit 1
fi

# --- 2. Auto-create .env if missing ---
if [ ! -f ".env" ]; then
    if [ ! -f ".env.example" ]; then
        print_err ".env.example not found. Cannot create .env automatically."
        exit 1
    fi

    print_info ".env not found. Creating from .env.example..."

    
    SECRET_KEY=$("$PYTHON_BIN" -c "import secrets; print(secrets.token_urlsafe(50))")

    
    cp .env.example .env
    sed -i "s/^SECRET_KEY=.*/SECRET_KEY=${SECRET_KEY}/" .env

   
    CURRENT_DB_PASS=$(grep "^DB_PASSWORD=" .env | cut -d'=' -f2)
    if [[ "$CURRENT_DB_PASS" == "change-this-password" ]]; then
        DB_PASS="himshravan@123456"
        sed -i "s/^DB_PASSWORD=.*/DB_PASSWORD=${DB_PASS}/" .env
        print_info "DB_PASSWORD set to default: ${DB_PASS}"
    fi

    chmod 600 .env
    print_ok ".env created with random SECRET_KEY"
else
    print_ok ".env already exists"
fi

# Load env vars for this session
sed -i 's/\r$//' .env 2>/dev/null || true
set -a
source .env
set +a

# Unset SSL_CERT_FILE so it doesn't break curl, wget, or pip downloads
unset SSL_CERT_FILE

# --- 3. Ensure PostgreSQL password is set ---
DB_PASSWORD=$(grep "^DB_PASSWORD=" .env | cut -d'=' -f2)
if command -v psql >/dev/null 2>&1; then
    print_info "Ensuring PostgreSQL password for 'postgres' user..."
    sudo -u postgres psql -c "ALTER USER postgres WITH PASSWORD '${DB_PASSWORD}';" 2>/dev/null || true
    print_ok "PostgreSQL password updated"
fi

# --- 4. Virtual Environment ---
if [ ! -x ".venv/bin/pip" ]; then
    rm -rf .venv
    print_info "Creating virtual environment..."
    if ! "$PYTHON_BIN" -m venv .venv; then
        print_info "Standard venv creation failed. Attempting without pip..."
        rm -rf .venv
        if ! "$PYTHON_BIN" -m venv --without-pip .venv; then
            print_err "Failed to create venv. Please run: sudo apt install python3.10-venv"
            exit 1
        fi
        print_info "Installing pip manually..."
        if command -v curl >/dev/null 2>&1; then
            curl -sS https://bootstrap.pypa.io/get-pip.py | .venv/bin/python
        else
            wget -qO- https://bootstrap.pypa.io/get-pip.py | .venv/bin/python
        fi
    fi
fi

source .venv/bin/activate 2>/dev/null || true

if [ ! -x ".venv/bin/pip" ]; then
    print_err "Virtual environment setup failed."
    exit 1
fi

print_info "Installing/Updating dependencies..."
.venv/bin/pip install --upgrade pip >/dev/null
if ! .venv/bin/pip install -r requirements.txt; then
    print_err "Failed to install dependencies."
    print_info "Hint: If psycopg2 failed, run 'sudo apt install libpq-dev python3.10-dev' and try again."
    exit 1
fi

# --- 5. Free port ---
print_info "Checking port ${PORT}..."
if command -v lsof >/dev/null 2>&1; then
    PID="$(lsof -ti :"${PORT}" 2>/dev/null || true)"
    if [ -n "$PID" ]; then
        print_info "Port ${PORT} in use. Stopping PID ${PID}..."
        kill -9 $PID 2>/dev/null || true
        sleep 1
    fi
else
    print_info "'lsof' not installed. Skipping port check."
fi

# --- 6. Run migrations ---
mkdir -p logs cache
print_info "Creating any missing migrations..."
.venv/bin/python manage.py makemigrations authentication device telemetry events notifications --noinput 2>/dev/null || true
print_info "Applying migrations..."
.venv/bin/python manage.py migrate --noinput

# --- 7. Create superuser (non-interactive) ---
SU_USER="${DJANGO_SUPERUSER_USERNAME:-admin}"
SU_PASS="${DJANGO_SUPERUSER_PASSWORD:-Admin@123}"
SU_EMAIL="${DJANGO_SUPERUSER_EMAIL:-admin@example.com}"

print_info "Ensuring Django superuser '${SU_USER}' exists..."
SU_USER="${SU_USER}" SU_PASS="${SU_PASS}" SU_EMAIL="${SU_EMAIL}" \
.venv/bin/python manage.py shell -c "
import os
from authentication.models import User
u = os.environ['SU_USER']
e = os.environ['SU_EMAIL']
p = os.environ['SU_PASS']
obj = User.objects.filter(username=u).first()
if obj is None:
    User.objects.create_superuser(username=u, email=e, password=p, role='SUPER_ADMIN')
    print('Superuser created')
else:
    obj.email = e
    obj.is_staff = True
    obj.is_superuser = True
    if hasattr(obj, 'role'):
        obj.role = 'SUPER_ADMIN'
    obj.set_password(p)
    obj.save()
    print('Superuser updated')
" || print_err "Superuser creation failed (check authentication app is migrated)."

print_ok "Superuser ready: ${SU_USER}"

# --- 8. Collect static ---
print_info "Collecting static files..."
.venv/bin/python manage.py collectstatic --noinput --clear >/dev/null


# --- 9. Start server ---
if [ ! -f "startup.sh" ]; then
    print_err "startup.sh not found. Cannot start server automatically."
    exit 1
fi

chmod +x startup.sh

print_ok "Bootstrap complete. Starting server..."
echo -e "${CYAN}----------------------------------------${NC}"
echo -e "${CYAN}  Server Details:${NC}"
echo -e "  - URL:  http://localhost:${PORT}/"
echo -e "  - Docs: http://localhost:${PORT}/api/docs/"
echo -e "  - API:  http://localhost:${PORT}/api/"
echo -e "${CYAN}----------------------------------------${NC}"
echo ""

exec ./startup.sh
