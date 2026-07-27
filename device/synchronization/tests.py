"""Smoke tests for the synchronization module."""

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from telemetry.models import (
    DroneTelemetry,
    SyncStatus,
    TelemetrySession,
)


class SynchronizationAPITest(TestCase):
    def setUp(self):
        User = get_user_model()
        self.user = User.objects.create_superuser(
            username="admin",
            email="admin@example.com",
            password="admin123",
            role=User.ROLE_SUPER_ADMIN,
        )
        self.client = APIClient()
        login = self.client.post(
            "/api/auth/login/",
            {"username": "admin", "password": "admin123"},
            format="json",
        )
        self.assertEqual(login.status_code, 200)
        tokens = login.json()
        self.access = tokens["access_token"]
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.access}")

        self.session = TelemetrySession.objects.create(
            session_name="Sync Test Session",
            status=TelemetrySession.STATUS_RUNNING,
            created_by="admin",
        )

    # ------------------------------------------------------------------
    # 1. Sync Start
    # ------------------------------------------------------------------
    def test_sync_start_creates_record(self):
        resp = self.client.post(
            "/api/sync/start/",
            {
                "session_id": str(self.session.session_id),
                "subsystem_type": "DF",
                "device_reference_id": "DF_NODE_001",
                "polling_interval": 10,
                "destination_ip": "192.168.20.10",
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 202, resp.json())
        body = resp.json()
        self.assertEqual(body["status"], "SUCCESS")
        self.assertEqual(body["data"]["sync_status"], "IN_PROGRESS")
        self.assertEqual(body["data"]["subsystem_type"], "DF")
        self.assertEqual(body["data"]["device_reference_id"], "DF_NODE_001")

    def test_sync_start_updates_existing_record(self):
        SyncStatus.objects.create(
            session=self.session,
            subsystem_type="DRONE",
            device_reference_id="DRONE_001",
            sync_status=SyncStatus.SYNC_PENDING,
            polling_interval=5,
        )
        resp = self.client.post(
            "/api/sync/start/",
            {
                "session_id": str(self.session.session_id),
                "subsystem_type": "DRONE",
                "device_reference_id": "DRONE_001",
                "polling_interval": 15,
                "destination_ip": "192.168.20.11",
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 202)
        body = resp.json()
        self.assertEqual(body["data"]["sync_status"], "IN_PROGRESS")
        self.assertEqual(body["data"]["polling_interval"], 15)

    def test_sync_start_invalid_session(self):
        resp = self.client.post(
            "/api/sync/start/",
            {
                "session_id": "00000000-0000-0000-0000-000000000000",
                "subsystem_type": "DF",
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 404)

    # ------------------------------------------------------------------
    # 2. Sync Export
    # ------------------------------------------------------------------
    def test_sync_export_with_data(self):
        DroneTelemetry.objects.create(
            session=self.session,
            drone_id="DRONE_001",
            drone_status="UP",
            drone_latitude=18.52,
            drone_longitude=73.85,
        )
        resp = self.client.post(
            "/api/sync/export/",
            {
                "session_id": str(self.session.session_id),
                "module": "DRONE",
                "selected_fields": ["drone_id", "drone_status", "drone_latitude"],
                "destination_ip": "192.168.20.10",
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 200, resp.json())
        body = resp.json()
        self.assertEqual(body["status"], "SUCCESS")
        self.assertEqual(body["data"]["exported_records"], 1)
        self.assertTrue(body["data"]["csv_file_name"].endswith(".csv"))
        self.assertTrue(body["data"]["download_url"].startswith("/exports/"))

    def test_sync_export_invalid_module(self):
        resp = self.client.post(
            "/api/sync/export/",
            {
                "session_id": str(self.session.session_id),
                "module": "INVALID_MODULE",
                "selected_fields": [],
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(resp.json()["status"], "FAILED")

    def test_sync_export_invalid_fields(self):
        resp = self.client.post(
            "/api/sync/export/",
            {
                "session_id": str(self.session.session_id),
                "module": "DRONE",
                "selected_fields": ["nonexistent_field"],
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(resp.json()["status"], "FAILED")

    def test_sync_export_empty_selected_fields_uses_all(self):
        DroneTelemetry.objects.create(session=self.session, drone_id="DRONE_002", drone_status="DOWN")
        resp = self.client.post(
            "/api/sync/export/",
            {
                "session_id": str(self.session.session_id),
                "module": "DRONE",
                "selected_fields": [],
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["data"]["exported_records"], 1)

    # ------------------------------------------------------------------
    # 3. Sync Status Overview
    # ------------------------------------------------------------------
    def test_sync_status_overview(self):
        SyncStatus.objects.create(
            session=self.session,
            subsystem_type="DF",
            device_reference_id="DF_NODE_001",
            sync_status=SyncStatus.SYNC_COMPLETED,
        )
        resp = self.client.get("/api/sync/status/")
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertEqual(body["status"], "SUCCESS")
        self.assertTrue(len(body["data"]) >= 1)

    def test_sync_status_overview_filtered(self):
        SyncStatus.objects.create(
            session=self.session,
            subsystem_type="DF",
            device_reference_id="DF_NODE_001",
            sync_status=SyncStatus.SYNC_COMPLETED,
        )
        SyncStatus.objects.create(
            session=self.session,
            subsystem_type="DRONE",
            device_reference_id="DRONE_001",
            sync_status=SyncStatus.SYNC_COMPLETED,
        )
        resp = self.client.get("/api/sync/status/?subsystem_type=DF")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()["data"]
        self.assertTrue(all(item["subsystem_type"] == "DF" for item in data))

    # ------------------------------------------------------------------
    # 4. Sync Status by Device
    # ------------------------------------------------------------------
    def test_sync_status_node(self):
        SyncStatus.objects.create(
            session=self.session,
            subsystem_type="DF",
            device_reference_id="NODE_001",
            sync_status=SyncStatus.SYNC_COMPLETED,
            exported_records=100,
        )
        resp = self.client.get("/api/sync/status/node/NODE_001/")
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertEqual(body["status"], "SUCCESS")
        self.assertEqual(body["data"]["device_reference_id"], "NODE_001")

    def test_sync_status_node_no_record(self):
        resp = self.client.get("/api/sync/status/node/UNKNOWN_NODE/")
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertEqual(body["status"], "SUCCESS")
        self.assertEqual(body["data"]["sync_status"], "PENDING")

    def test_sync_status_drone(self):
        SyncStatus.objects.create(
            session=self.session,
            subsystem_type="DRONE",
            device_reference_id="DRONE_X",
            sync_status=SyncStatus.SYNC_COMPLETED,
        )
        resp = self.client.get("/api/sync/status/drone/DRONE_X/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["data"]["device_reference_id"], "DRONE_X")

    def test_sync_status_satellite(self):
        SyncStatus.objects.create(
            session=self.session,
            subsystem_type="SATELLITE",
            device_reference_id="SAT_001",
            sync_status=SyncStatus.SYNC_COMPLETED,
        )
        resp = self.client.get("/api/sync/status/satellite/SAT_001/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["data"]["device_reference_id"], "SAT_001")

    def test_sync_status_passive_cellular(self):
        SyncStatus.objects.create(
            session=self.session,
            subsystem_type="PASSIVE_CELLULAR",
            device_reference_id="PC_001",
            sync_status=SyncStatus.SYNC_COMPLETED,
        )
        resp = self.client.get("/api/sync/status/passive-cellular/PC_001/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["data"]["device_reference_id"], "PC_001")

    def test_sync_status_active_cellular(self):
        SyncStatus.objects.create(
            session=self.session,
            subsystem_type="ACTIVE_CELLULAR",
            device_reference_id="AC_001",
            sync_status=SyncStatus.SYNC_COMPLETED,
        )
        resp = self.client.get("/api/sync/status/active-cellular/AC_001/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["data"]["device_reference_id"], "AC_001")
