import argparse
import sys
import time
from datetime import datetime

try:
    import requests
except ImportError:
    print("ERROR: 'requests' library is required. Install it with: pip install requests")
    sys.exit(1)


# ─── Colored Console Output ─────────────────────────────────────────────────


class Colors:
    HEADER = "\033[95m"
    BLUE = "\033[94m"
    CYAN = "\033[96m"
    GREEN = "\033[92m"
    YELLOW = "\033[93m"
    RED = "\033[91m"
    BOLD = "\033[1m"
    END = "\033[0m"


def log_step(step_num, total, message):
    print(f"\n{Colors.BOLD}{Colors.CYAN}{'=' * 60}{Colors.END}")
    print(f"  {Colors.BOLD}STEP {step_num}/{total}{Colors.END} — {Colors.GREEN}{message}{Colors.END}")
    print(f"{Colors.CYAN}{'=' * 60}{Colors.END}")


def log_info(message):
    print(f"  {Colors.BLUE}ℹ{Colors.END}  {message}")


def log_success(message):
    print(f"  {Colors.GREEN}✓{Colors.END}  {message}")


def log_warn(message):
    print(f"  {Colors.YELLOW}⚠{Colors.END}  {message}")


def log_error(message):
    print(f"  {Colors.RED}✗{Colors.END}  {message}")


def log_data(label, value):
    print(f"      {Colors.CYAN}{label:20s}{Colors.END} : {value}")


# ─── API Client ──────────────────────────────────────────────────────────────


class HimshravanClient:
    """Client for interacting with the HIMSHRAVAN backend API."""

    def __init__(self, base_url):
        self.base_url = base_url.rstrip("/")
        self.session = requests.Session()
        self.access_token = None
        self.refresh_token = None

    def _headers(self):
        headers = {"Content-Type": "application/json"}
        if self.access_token:
            headers["Authorization"] = f"Bearer {self.access_token}"
        return headers

    def _url(self, path):
        return f"{self.base_url}{path}"

    # ── Step 1: Login ──

    def login(self, username, password):
        """Authenticate and obtain JWT tokens."""
        resp = self.session.post(
            self._url("/api/auth/login/"),
            json={"username": username, "password": password},
            headers={"Content-Type": "application/json"},
        )
        resp.raise_for_status()
        data = resp.json()
        self.access_token = data.get("access")
        self.refresh_token = data.get("refresh")
        return data

    # ── Step 3: Register Device ──

    def register_device(self, device_data):
        """Register a device via POST /api/device/create/."""
        payload = {
            "device_type": device_data.get("device_type", "NODE"),
            "ip_address": device_data.get("ip_address"),
            "node_id": device_data.get("node_id", ""),
            "node_name": device_data.get("node_name", ""),
            "heartbeat_status": "ACTIVE",
            "network_status": "ONLINE",
        }
        resp = self.session.post(
            self._url("/api/device/create/"),
            json=payload,
            headers=self._headers(),
        )
        resp.raise_for_status()
        return resp.json()

    # ── Step 4: Heartbeat Check ──

    def heartbeat_check(self, ip_address, subsystem_name=""):
        """Check heartbeat via POST /api/v1/heartbeat/check/."""
        payload = {
            "subsystem_name": subsystem_name,
            "ip_address": ip_address,
        }
        resp = self.session.post(
            self._url("/api/v1/heartbeat/check/"),
            json=payload,
            headers=self._headers(),
        )
        resp.raise_for_status()
        return resp.json()

    # ── Step 5: Create Session ──

    def create_session(self, session_name, operation_mode, session_type, devices, node_id, lat, lng, polling_interval):
        """Create a telemetry session via POST /api/session/create/."""
        payload = {
            "session_name": session_name,
            "operation_mode": operation_mode,
            "session_type": session_type,
            "node_id": node_id,
            "node_lat": lat,
            "node_long": lng,
            "polling_interval": polling_interval,
            "remarks": f"Auto-created by discovery_agent at {datetime.now().isoformat()}",
        }

        # Map device IPs to session IP fields
        ip_mapping = {
            "DF": "df_system_ip",
            "MONITORING": "monitoring_system_ip",
            "DRONE": "drone_detector_ip",
            "SATELLITE": "satellite_interception_ip",
            "PASSIVE_CELLULAR": "cellular_passive_ip",
            "ACTIVE_CELLULAR": "cellular_active_ip",
        }
        for dev in devices:
            subsystem = dev.get("subsystem", "")
            field = ip_mapping.get(subsystem)
            if field and dev.get("ip_address"):
                payload[field] = dev["ip_address"]

        resp = self.session.post(
            self._url("/api/session/create/"),
            json=payload,
            headers=self._headers(),
        )
        resp.raise_for_status()
        return resp.json()

    # ── Step 6: Push Telemetry ──

    def push_telemetry(self, subsystem, telemetry_data, session_id):
        """Push telemetry data to the correct endpoint based on subsystem type."""
        endpoint_map = {
            "DF": "/api/telemetry/df/",
            "MONITORING": "/api/telemetry/monitoring/",
            "DRONE": "/api/telemetry/drone/",
            "SATELLITE": "/api/telemetry/satellite/",
            "PASSIVE_CELLULAR": "/api/telemetry/cellular-passive/",
            "ACTIVE_CELLULAR": "/api/telemetry/cellular-active/",
        }
        endpoint = endpoint_map.get(subsystem)
        if not endpoint:
            log_warn(f"Unknown subsystem: {subsystem}, skipping")
            return None

        telemetry_data["session_id"] = session_id
        resp = self.session.post(
            self._url(endpoint),
            json=telemetry_data,
            headers=self._headers(),
        )
        resp.raise_for_status()
        return resp.json()

    # ── Step 7a: Export CSV ──

    def export_csv(self, session_id, module, selected_fields=None):
        """Export telemetry data to CSV via POST /api/sync/export/."""
        payload = {
            "session_id": session_id,
            "module": module,
        }
        if selected_fields:
            payload["selected_fields"] = selected_fields
        resp = self.session.post(
            self._url("/api/sync/export/"),
            json=payload,
            headers=self._headers(),
        )
        resp.raise_for_status()
        return resp.json()

    # ── Step 7b: Stop Session ──

    def stop_session(self, session_id, reason=""):
        """Stop a session via POST /api/session/stop/."""
        payload = {
            "session_id": session_id,
            "stop_reason": reason or "Completed by discovery_agent",
        }
        resp = self.session.post(
            self._url("/api/session/stop/"),
            json=payload,
            headers=self._headers(),
        )
        resp.raise_for_status()
        return resp.json()


# ─── Device Server Client ───────────────────────────────────────────────────


class DeviceServerClient:
    """Client for connecting to the mock (or real) device data server."""

    def __init__(self, server_url):
        self.server_url = server_url.rstrip("/")

    def discover_devices(self):
        """GET /devices — returns list of device dicts."""
        resp = requests.get(f"{self.server_url}/devices")
        resp.raise_for_status()
        data = resp.json()
        return data.get("devices", [])

    def get_telemetry(self, node_id):
        """GET /telemetry/<node_id> — returns telemetry data dict."""
        resp = requests.get(f"{self.server_url}/telemetry/{node_id}")
        resp.raise_for_status()
        data = resp.json()
        return data.get("telemetry", {})

    def health_check(self):
        """GET /health — returns health status."""
        resp = requests.get(f"{self.server_url}/health")
        resp.raise_for_status()
        return resp.json()


# ─── Main Agent Flow ─────────────────────────────────────────────────────────


def run_agent(args):
    """Execute the complete discovery → register → session → pull → export flow."""

    total_steps = 7
    client = HimshravanClient(args.backend)
    device_server = DeviceServerClient(args.server)

    print(f"\n{Colors.BOLD}{Colors.HEADER}")
    print("  ╔══════════════════════════════════════════════════════╗")
    print("  ║   HIMSHRAVAN V1 — Device Discovery & Telemetry Agent ║")
    print("  ╚══════════════════════════════════════════════════════╝")
    print(f"{Colors.END}")
    log_info(f"Backend : {args.backend}")
    log_info(f"Server  : {args.server}")
    log_info(f"User    : {args.username}")
    log_info(f"Session : {args.session_type}")
    log_info(f"Polling : {args.polling_interval}s")
    log_info(f"Duration: {args.pull_duration}s")

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # STEP 1: LOGIN
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    log_step(1, total_steps, "LOGIN")
    try:
        login_resp = client.login(args.username, args.password)
        log_success("Login successful!")
        log_data("Access Token", client.access_token[:40] + "...")
        log_data("Role", login_resp.get("role", "N/A"))
    except requests.exceptions.ConnectionError:
        log_error(f"Cannot connect to backend at {args.backend}")
        sys.exit(1)
    except requests.exceptions.HTTPError as e:
        log_error(f"Login failed: {e.response.status_code} — {e.response.text}")
        sys.exit(1)

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # STEP 2: RUN DISCOVERY SCRIPT (connect to device server)
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    log_step(2, total_steps, "DISCOVER DEVICES")
    try:
        health = device_server.health_check()
        log_success(f"Device server is UP — {health.get('device_count', 0)} devices available")
    except requests.exceptions.ConnectionError:
        log_error(f"Cannot connect to device server at {args.server}")
        sys.exit(1)

    devices = device_server.discover_devices()
    log_success(f"Discovered {len(devices)} device(s)")
    print()
    for i, dev in enumerate(devices, 1):
        print(f"    {Colors.BOLD}Device #{i}{Colors.END}")
        log_data("device_type", dev.get("device_type"))
        log_data("ip_address", dev.get("ip_address"))
        log_data("node_id", dev.get("node_id"))
        log_data("node_name", dev.get("node_name"))
        log_data("subsystem", dev.get("subsystem"))
        log_data("latitude", dev.get("latitude"))
        log_data("longitude", dev.get("longitude"))
        print()

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # STEP 3: REGISTER DEVICES
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    log_step(3, total_steps, "REGISTER DEVICES")
    registered_devices = []
    for dev in devices:
        try:
            result = client.register_device(dev)
            device_data = result.get("data", {})
            registered_id = device_data.get("device_id", "N/A")
            log_success(f"Registered {dev['node_id']} → device_id: {registered_id}")
            registered_devices.append({**dev, "backend_device_id": registered_id})
        except requests.exceptions.HTTPError as e:
            log_error(f"Failed to register {dev['node_id']}: {e.response.status_code}")
            # Still add for heartbeat check
            registered_devices.append(dev)

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # STEP 4: HEARTBEAT CHECK
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    log_step(4, total_steps, "HEARTBEAT CHECK")
    online_devices = []
    for dev in registered_devices:
        ip = dev.get("ip_address")
        subsystem = dev.get("subsystem", "")
        try:
            hb = client.heartbeat_check(ip, subsystem)
            hb_data = hb.get("data", {})
            status = hb_data.get("status", "UNKNOWN")
            latency = hb_data.get("latency_ms", "N/A")
            if status == "ONLINE":
                log_success(f"{ip:18s} → {Colors.GREEN}ONLINE{Colors.END}  (latency: {latency}ms)")
                online_devices.append(dev)
            else:
                log_warn(f"{ip:18s} → {Colors.RED}OFFLINE{Colors.END}")
                # Include anyway for session creation
                online_devices.append(dev)
        except requests.exceptions.HTTPError:
            log_warn(f"{ip:18s} → HEARTBEAT CHECK FAILED (including anyway)")
            online_devices.append(dev)

    if not online_devices:
        log_error("No devices available. Exiting.")
        sys.exit(1)

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # STEP 5: CREATE SESSION
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    log_step(5, total_steps, f"CREATE SESSION ({args.session_type.upper()})")

    # Use first device's location as the node reference
    primary_device = online_devices[0]
    session_name = f"discovery_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

    try:
        session_resp = client.create_session(
            session_name=session_name,
            operation_mode=primary_device.get("subsystem", "DF"),
            session_type=args.session_type,
            devices=online_devices,
            node_id=primary_device.get("node_id", ""),
            lat=primary_device.get("latitude", 0.0),
            lng=primary_device.get("longitude", 0.0),
            polling_interval=args.polling_interval,
        )
        session_data = session_resp.get("data", {})
        session_id = session_data.get("session_id")
        log_success(f"Session created: {session_name}")
        log_data("session_id", session_id)
        log_data("status", session_data.get("status"))
        log_data("session_type", session_data.get("session_type"))
        log_data("polling_interval", f"{session_data.get('polling_interval')}s")
    except requests.exceptions.HTTPError as e:
        log_error(f"Failed to create session: {e.response.status_code} — {e.response.text}")
        sys.exit(1)

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # STEP 6: PULL DATA (Time-based polling)
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    log_step(6, total_steps, f"PULL DATA (duration: {args.pull_duration}s, interval: {args.polling_interval}s)")

    subsystem_record_counts = {}
    start_time = time.time()
    poll_count = 0

    while (time.time() - start_time) < args.pull_duration:
        poll_count += 1
        elapsed = int(time.time() - start_time)
        remaining = args.pull_duration - elapsed
        print(f"\n  {Colors.BOLD}── Poll #{poll_count} (elapsed: {elapsed}s, remaining: {remaining}s) ──{Colors.END}")

        for dev in online_devices:
            node_id = dev.get("node_id")
            subsystem = dev.get("subsystem", "DF")

            try:
                # Fetch telemetry from device server
                telemetry = device_server.get_telemetry(node_id)

                # Push to backend
                result = client.push_telemetry(subsystem, telemetry, session_id)
                if result:
                    subsystem_record_counts[subsystem] = subsystem_record_counts.get(subsystem, 0) + 1
                    log_success(f"[{subsystem:20s}] {node_id} → stored (total: {subsystem_record_counts[subsystem]})")
            except requests.exceptions.HTTPError as e:
                log_error(f"[{subsystem:20s}] {node_id} → FAILED ({e.response.status_code})")
            except requests.exceptions.ConnectionError:
                log_error(f"[{subsystem:20s}] {node_id} → CONNECTION ERROR")

        # Wait for next poll
        if (time.time() - start_time + args.polling_interval) < args.pull_duration:
            log_info(f"Waiting {args.polling_interval}s for next poll...")
            time.sleep(args.polling_interval)
        else:
            break

    print(f"\n  {Colors.BOLD}Polling complete!{Colors.END}")
    print(f"  Total polls: {poll_count}")
    for sub, count in subsystem_record_counts.items():
        log_data(sub, f"{count} records")

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # STEP 7: GENERATE CSV & CLOSE SESSION
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    log_step(7, total_steps, "GENERATE CSV & CLOSE SESSION")

    # Export CSV for each subsystem that has data
    module_map = {
        "DF": "DF",
        "MONITORING": "MONITORING",
        "DRONE": "DRONE",
        "SATELLITE": "SATELLITE",
        "PASSIVE_CELLULAR": "CELLULAR_PASSIVE",
        "ACTIVE_CELLULAR": "CELLULAR_ACTIVE",
    }

    for subsystem, _count in subsystem_record_counts.items():
        module = module_map.get(subsystem, subsystem)
        try:
            export_resp = client.export_csv(session_id, module)
            export_data = export_resp.get("data", {})
            log_success(
                f"CSV exported: {export_data.get('csv_file_name', 'N/A')} "
                f"({export_data.get('exported_records', 0)} records)"
            )
            log_data("Download URL", export_data.get("download_url", "N/A"))
        except requests.exceptions.HTTPError as e:
            log_warn(f"CSV export failed for {module}: {e.response.status_code}")

    # Stop session
    try:
        stop_resp = client.stop_session(session_id, "Discovery agent completed")
        stop_data = stop_resp.get("data", {})
        log_success(f"Session stopped: {stop_data.get('status', 'STOPPED')}")
        log_data("stop_time", stop_data.get("stop_time", "N/A"))
    except requests.exceptions.HTTPError as e:
        log_error(f"Failed to stop session: {e.response.status_code}")

    # ── Final Summary ──
    print(f"\n{Colors.BOLD}{Colors.GREEN}")
    print("  ╔══════════════════════════════════════════════════════╗")
    print("  ║              AGENT COMPLETED SUCCESSFULLY            ║")
    print("  ╚══════════════════════════════════════════════════════╝")
    print(f"{Colors.END}")
    log_data("Session", session_name)
    log_data("Session ID", session_id)
    log_data("Devices", str(len(online_devices)))
    log_data("Total Records", str(sum(subsystem_record_counts.values())))
    log_data("Subsystems", ", ".join(subsystem_record_counts.keys()))
    print()


# ─── CLI Entry Point ─────────────────────────────────────────────────────────


def main():
    parser = argparse.ArgumentParser(
        description="HIMSHRAVAN V1 — Device Discovery & Telemetry Agent",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Complete Flow:
  1. Login to HIMSHRAVAN backend
  2. Discover devices from device server
  3. Register devices via POST /api/device/register/
  4. Heartbeat check each device IP
  5. Create telemetry session (Manual or Auto)
  6. Poll & push telemetry data to backend
  7. Export CSV and stop session

Examples:
  # Basic run (localhost defaults):
  python discovery_agent.py

  # Full deployment:
  python discovery_agent.py \\
      --backend http://192.168.1.10:8000 \\
      --server  http://192.168.1.50:9000 \\
      --username admin \\
      --password Admin@123 \\
      --session-type Manual \\
      --polling-interval 10 \\
      --pull-duration 120
        """,
    )
    parser.add_argument(
        "--backend",
        default="http://127.0.0.1:8000",
        help="HIMSHRAVAN backend URL (default: http://127.0.0.1:8000)",
    )
    parser.add_argument(
        "--server",
        default="http://127.0.0.1:9000",
        help="Device data server URL (default: http://127.0.0.1:9000)",
    )
    parser.add_argument(
        "--username",
        default="admin",
        help="Login username (default: admin)",
    )
    parser.add_argument(
        "--password",
        default="Admin@123",
        help="Login password (default: Admin@123)",
    )
    parser.add_argument(
        "--session-type",
        choices=["Manual", "Auto"],
        default="Manual",
        help="Session type: Manual or Auto (default: Manual)",
    )
    parser.add_argument(
        "--polling-interval",
        type=int,
        default=10,
        help="Polling interval in seconds (default: 10)",
    )
    parser.add_argument(
        "--pull-duration",
        type=int,
        default=60,
        help="Total data pull duration in seconds (default: 60)",
    )
    parser.add_argument(
        "--operation-mode",
        default="",
        help="Operation mode for the session (e.g., DF, LF)",
    )

    args = parser.parse_args()
    run_agent(args)


if __name__ == "__main__":
    main()
