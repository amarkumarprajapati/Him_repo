#!/usr/bin/env bash
set -euo pipefail

if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
fi

PORT="${PORT:-8001}"
HOST="${HOST:-0.0.0.0}"
DEBUG="${DEBUG:-False}"
LOCAL_HTTPS="${LOCAL_HTTPS:-False}"
SSL_CERT_FILE="${SSL_CERT_FILE:-certs/localhost.crt}"
SSL_KEY_FILE="${SSL_KEY_FILE:-certs/localhost.key}"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}      Starting Himshravan V1 EWCPS      ${NC}"
echo -e "${GREEN}========================================${NC}"


if [ -d ".venv" ]; then
    source .venv/bin/activate
fi

if [[ "${LOCAL_HTTPS}" == "True" ]]; then
    if ! command -v openssl >/dev/null 2>&1; then
        echo -e "${RED}[ERR] openssl is required for LOCAL_HTTPS=True${NC}"
        exit 1
    fi

    mkdir -p "$(dirname "${SSL_CERT_FILE}")"

    if [ ! -f "${SSL_CERT_FILE}" ] || [ ! -f "${SSL_KEY_FILE}" ]; then
        echo -e "${YELLOW}Generating local self-signed TLS certificate...${NC}"
        openssl req -x509 -nodes -newkey rsa:2048 \
            -keyout "${SSL_KEY_FILE}" \
            -out "${SSL_CERT_FILE}" \
            -days 365 \
            -subj "/CN=localhost" \
            -addext "subjectAltName=DNS:localhost,IP:127.0.0.1" >/dev/null 2>&1
        chmod 600 "${SSL_KEY_FILE}" "${SSL_CERT_FILE}"
    fi
fi

echo -e "${YELLOW}Running database migrations...${NC}"
python manage.py migrate --noinput

echo -e "${YELLOW}Ensuring default admin user exists...${NC}"
python manage.py create_default_admin

echo -e "${YELLOW}Collecting static files...${NC}"
python manage.py collectstatic --noinput --clear > /dev/null

detect_lan_ip() {
    if command -v ip >/dev/null 2>&1; then
        ip -4 route get 1.1.1.1 2>/dev/null \
            | awk '{for (i = 1; i <= NF; i++) if ($i == "src") { print $(i + 1); exit }}'
        return
    fi
    hostname -I 2>/dev/null | awk '{print $1}'
}

LAN_IP="$(detect_lan_ip || true)"

echo -e "${GREEN}----------------------------------------${NC}"
echo -e "${CYAN}  Server Details:${NC}"
echo -e "  - Mode: $( [[ "$DEBUG" == "True" ]] && echo "Development" || echo "Production" )"
echo -e "  - Port: ${PORT}"
if [[ "${LOCAL_HTTPS}" == "True" ]]; then
    echo -e "  - URL:  https://localhost:${PORT}/"
    echo -e "  - Docs: https://localhost:${PORT}/api/docs/"
    if [ -n "$LAN_IP" ] && [ "$LAN_IP" != "127.0.0.1" ]; then
        echo -e "  - LAN:  https://${LAN_IP}:${PORT}/"
    fi
else
    echo -e "  - URL:  http://localhost:${PORT}/"
    echo -e "  - Docs: http://localhost:${PORT}/api/docs/"
    if [ -n "$LAN_IP" ] && [ "$LAN_IP" != "127.0.0.1" ]; then
        echo -e "  - LAN:  http://${LAN_IP}:${PORT}/  (desktop clients use this IP)"
    fi
fi
echo -e "${GREEN}----------------------------------------${NC}"

# Free the listen port if a previous server instance is still running.
free_port() {
    local port="$1"
    local pids=""

    if command -v lsof >/dev/null 2>&1; then
        pids=$(lsof -ti ":${port}" -sTCP:LISTEN 2>/dev/null || true)
        if [ -z "$pids" ]; then
            pids=$(lsof -ti ":${port}" 2>/dev/null || true)
        fi
    elif command -v fuser >/dev/null 2>&1; then
        if fuser "${port}/tcp" >/dev/null 2>&1; then
            echo -e "${YELLOW}Stopping process on port ${port}...${NC}"
            fuser -k "${port}/tcp" >/dev/null 2>&1 || true
            sleep 1
            return 0
        fi
        return 0
    elif command -v ss >/dev/null 2>&1; then
        pids=$(ss -ltnp "sport = :${port}" 2>/dev/null | grep -oE 'pid=[0-9]+' | cut -d= -f2 | sort -u || true)
    fi

    if [ -z "$pids" ]; then
        return 0
    fi

    echo -e "${YELLOW}Stopping process(es) on port ${port}: $(echo "$pids" | tr '\n' ' ')${NC}"
    kill -TERM $pids 2>/dev/null || true
    sleep 1

    if command -v lsof >/dev/null 2>&1; then
        pids=$(lsof -ti ":${port}" 2>/dev/null || true)
    fi

    if [ -n "$pids" ]; then
        kill -KILL $pids 2>/dev/null || true
        sleep 1
    fi
}

echo -e "${YELLOW}Checking port ${PORT}...${NC}"
free_port "${PORT}"

echo -e "${YELLOW}Launching Gunicorn...${NC}"

if [[ "${LOCAL_HTTPS}" == "True" ]]; then
    exec gunicorn core.wsgi:application \
        --config core/gunicorn.conf.py \
        --bind "${HOST}:${PORT}" \
        --certfile "${SSL_CERT_FILE}" \
        --keyfile "${SSL_KEY_FILE}"
else
    exec gunicorn core.wsgi:application \
        --config core/gunicorn.conf.py \
        --bind "${HOST}:${PORT}"
fi