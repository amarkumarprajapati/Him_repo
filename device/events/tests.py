from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from telemetry.models import TelemetrySession

from .models import EventLog


class EventsAPITest(TestCase):
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
            session_name="Event Test Session",
            status=TelemetrySession.STATUS_RUNNING,
            created_by="admin",
        )

        self.event = EventLog.objects.create(
            session_id=self.session.session_id,
            subsystem_type="DF",
            severity=EventLog.SEVERITY_HIGH,
            event_type="RF_THREAT",
            device_reference_id="DF_NODE_001",
            message="Strong RF signal detected",
        )

    # ------------------------------------------------------------------
    # List
    # ------------------------------------------------------------------
    def test_list_events(self):
        resp = self.client.get("/api/events/")
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertEqual(body["status"], "SUCCESS")
        self.assertEqual(body["message"], "Events retrieved successfully")
        self.assertGreaterEqual(len(body["results"]), 1)

    def test_list_events_filter_by_severity(self):
        resp = self.client.get("/api/events/?severity=HIGH")
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertTrue(all(e["severity"] == "HIGH" for e in body["results"]))

    def test_list_events_filter_by_subsystem(self):
        resp = self.client.get("/api/events/?subsystem_type=DF")
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertTrue(all(e["subsystem_type"] == "DF" for e in body["results"]))

    def test_list_events_filter_by_session_id(self):
        resp = self.client.get(f"/api/events/?session_id={self.session.session_id}")
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertTrue(all(str(e["session_id"]) == str(self.session.session_id) for e in body["results"]))

    def test_list_events_filter_by_event_type(self):
        resp = self.client.get("/api/events/?event_type=RF_THREAT")
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertTrue(all(e["event_type"] == "RF_THREAT" for e in body["results"]))

    # ------------------------------------------------------------------
    # System Health
    # ------------------------------------------------------------------
    def test_system_health(self):
        resp = self.client.get("/api/system/health/")
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertEqual(body["status"], "SUCCESS")
        self.assertIn("data", body)
        self.assertIn("cpu", body["data"])
        self.assertIn("memory", body["data"])
        self.assertIn("disk", body["data"])
        self.assertIn("network", body["data"])
        self.assertTrue(EventLog.objects.filter(subsystem_type="SYSTEM", event_type="INFO").exists())

