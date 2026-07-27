"""Smoke tests for the Himshravan V1 doc-aligned telemetry pipeline."""

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from .models import DFTelemetry, DroneTelemetry, TelemetrySession


class HimshravanV1APITest(TestCase):
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
        self.assertEqual(tokens["role"], User.ROLE_SUPER_ADMIN)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.access}")


    def test_session_lifecycle(self):
        create = self.client.post(
            "/api/session/create/",
            {
                "session_name": "EW_TEST_SESSION",
                "session_type": "MANUAL",
                "polling_interval": 5,
                "df_system_ip": "192.168.10.11",
                "drone_detector_ip": "192.168.10.12",
            },
            format="json",
        )
        self.assertEqual(create.status_code, 201, create.json())
        session_id = create.json()["data"]["session_id"]
        self.assertTrue(TelemetrySession.objects.filter(session_id=session_id).exists())

        status = self.client.get(f"/api/session/status/?session_id={session_id}")
        self.assertEqual(status.status_code, 200)

        stop = self.client.post(
            "/api/session/stop/",
            {"session_id": session_id, "stop_reason": "Test complete"},
            format="json",
        )
        self.assertEqual(stop.status_code, 200, stop.json())
        session = TelemetrySession.objects.get(session_id=session_id)
        self.assertEqual(session.status, TelemetrySession.STATUS_STOPPED)
        self.assertEqual(session.stop_reason, "Test complete")


    def test_df_telemetry_store_and_fetch(self):
        session = TelemetrySession.objects.create(session_name="DF Smoke", status=TelemetrySession.STATUS_RUNNING)
        payload = {
            "session_id": str(session.session_id),
            "node_id": "DF_NODE_001",
            "master_lat": 18.5204,
            "master_long": 73.8567,
            "time_stamp": "2026-02-25T16:04:29Z",
            "target_lat": 18.5304,
            "target_long": 73.8667,
            "frequency": 900.0,
            "bandwidth": 20.0,
            "power_dbm": -65.5,
        }
        store = self.client.post("/api/telemetry/df/", payload, format="json")
        self.assertEqual(store.status_code, 201, store.json())
        self.assertEqual(DFTelemetry.objects.count(), 1)

        fetch = self.client.get("/api/telemetry/df/DF_NODE_001/")
        self.assertEqual(fetch.status_code, 200)
        self.assertEqual(fetch.json()["status"], "SUCCESS")

    def test_drone_telemetry_summary_and_fetch(self):
        session = TelemetrySession.objects.create(session_name="Drone Smoke", status=TelemetrySession.STATUS_RUNNING)
        DroneTelemetry.objects.create(
            session=session,
            drone_id="DRONE_001",
            drone_detected=True,
            drone_type="DJI Phantom",
            drone_latitude=73.235,
            drone_longitude=18.08943,
            confidence=0.85,
            altitude_m=100.0,
        )
        self.assertEqual(DroneTelemetry.objects.count(), 1)

        summary = self.client.get("/api/telemetry/drone/")
        self.assertEqual(summary.status_code, 200)
        self.assertEqual(summary.json()["status"], "SUCCESS")

        fetch = self.client.get("/api/telemetry/drone/DRONE_001/")
        self.assertEqual(fetch.status_code, 200)

 
    def test_sync_status_by_node(self):
        resp = self.client.get("/api/sync/status/node/DF_NODE_001/")
        self.assertEqual(resp.status_code, 200)
        self.assertIn("subsystem_type", resp.json()["data"])

    def test_events_listing(self):
        resp = self.client.get("/api/events/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["status"], "SUCCESS")


    def test_csv_export(self):
        session = TelemetrySession.objects.create(session_name="Export Smoke", status=TelemetrySession.STATUS_RUNNING)
        DroneTelemetry.objects.create(session=session, drone_id="DRONE_X", drone_detected=True, drone_type="DJI Mavic")
        resp = self.client.post(
            "/api/export/csv/",
            {
                "session_id": str(session.session_id),
                "module": "DRONE",
                "selected_fields": ["drone_id", "drone_type"],
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 200, resp.json())
        body = resp.json()["data"]
        self.assertGreaterEqual(body["exported_records"], 1)
        self.assertTrue(body["csv_file_name"].endswith(".csv"))

 
    def test_heartbeat_endpoint(self):
        hb = self.client.post("/api/v1/heartbeat/check/", {"ip_address": "192.168.1.10"}, format="json")
        self.assertEqual(hb.status_code, 200)
        self.assertIn("status", hb.json()["data"])
