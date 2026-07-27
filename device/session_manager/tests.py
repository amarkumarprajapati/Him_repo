"""Smoke tests for the session manager module."""

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from telemetry.models import TelemetrySession


class SessionAPITest(TestCase):
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

    # ------------------------------------------------------------------
    # Create
    # ------------------------------------------------------------------
    def test_create_session(self):
        resp = self.client.post(
            "/api/session/create/",
            {
                "session_name": "Test Session",
                "operation_mode": "LF",
                "node_id": "9",
                "node_lat": 18.506145,
                "node_long": 73.856589,
                "polling_interval": 10,
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 201)
        body = resp.json()
        self.assertEqual(body["status"], "SUCCESS")
        self.assertIn("session_id", body["data"])
        self.assertEqual(len(body["data"]), 1)

    def test_create_session_with_subsystem_ips(self):
        resp = self.client.post(
            "/api/session/create/",
            {
                "session_name": "Full Config Session",
                "operation_mode": "HF",
                "node_id": "10",
                "node_lat": 19.0,
                "node_long": 74.0,
                "polling_interval": 5,
                "df_system_ip": "192.168.10.11",
                "drone_detector_ip": "192.168.10.12",
                "monitoring_system_ip": "192.168.10.13",
                "cellular_active_ip": "192.168.10.14",
                "cellular_passive_ip": "192.168.10.15",
                "satellite_interception_ip": "192.168.10.16",
                "remarks": "Test run",
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 201)
        body = resp.json()
        self.assertIn("session_id", body["data"])
        self.assertEqual(len(body["data"]), 1)

    # ------------------------------------------------------------------
    # Stop
    # ------------------------------------------------------------------
    def test_stop_session(self):
        session = TelemetrySession.objects.create(
            session_name="Active Session",
            status=TelemetrySession.STATUS_RUNNING,
            created_by="admin",
        )
        resp = self.client.post(
            "/api/session/stop/",
            {"session_id": str(session.session_id), "stop_reason": "Test complete"},
            format="json",
        )
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertEqual(body["status"], "SUCCESS")
        session.refresh_from_db()
        self.assertEqual(session.status, TelemetrySession.STATUS_STOPPED)
        self.assertEqual(session.stop_reason, "Test complete")

    def test_stop_session_invalid_id(self):
        resp = self.client.post(
            "/api/session/stop/",
            {"session_id": "00000000-0000-0000-0000-000000000000"},
            format="json",
        )
        self.assertEqual(resp.status_code, 404)

    # ------------------------------------------------------------------
    # Status
    # ------------------------------------------------------------------
    def test_session_status_latest_active(self):
        TelemetrySession.objects.create(
            session_name="Stopped",
            status=TelemetrySession.STATUS_STOPPED,
            created_by="admin",
        )
        TelemetrySession.objects.create(
            session_name="Active",
            status=TelemetrySession.STATUS_RUNNING,
            created_by="admin",
        )
        resp = self.client.get("/api/session/status/")
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertEqual(body["status"], "SUCCESS")
        self.assertEqual(body["data"]["session_name"], "Active")

    def test_session_status_by_id(self):
        session = TelemetrySession.objects.create(
            session_name="Specific",
            status=TelemetrySession.STATUS_RUNNING,
            created_by="admin",
        )
        resp = self.client.get(f"/api/session/status/?session_id={session.session_id}")
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertEqual(body["data"]["session_name"], "Specific")

    def test_session_status_no_active(self):
        TelemetrySession.objects.create(
            session_name="Stopped",
            status=TelemetrySession.STATUS_STOPPED,
            created_by="admin",
        )
        resp = self.client.get("/api/session/status/")
        self.assertEqual(resp.status_code, 404)
        self.assertEqual(resp.json()["status"], "FAILED")
