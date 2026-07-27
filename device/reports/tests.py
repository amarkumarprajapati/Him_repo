"""Smoke tests for the reports module."""

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from telemetry.models import (
    DFTelemetry,
    DroneTelemetry,
    MonitoringTelemetry,
    TelemetrySession,
)


class ReportsAPITest(TestCase):
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
            session_name="Report Test Session",
            status=TelemetrySession.STATUS_RUNNING,
            created_by="admin",
        )

    # ------------------------------------------------------------------
    # Statistical Report
    # ------------------------------------------------------------------
    def test_statistical_report_global(self):
        DFTelemetry.objects.create(session=self.session, node_id="DF_001", power_dbm=10.5)
        MonitoringTelemetry.objects.create(session=self.session, node_id="MON_001", snr=20.5)
        DroneTelemetry.objects.create(session=self.session, drone_id="DRONE_001", drone_status="UP")

        resp = self.client.get("/api/reports/statistical/")
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertEqual(body["status"], "SUCCESS")
        self.assertEqual(body["data"]["DF"], 1)
        self.assertEqual(body["data"]["MONITORING"], 1)
        self.assertEqual(body["data"]["DRONE"], 1)

    def test_statistical_report_by_session(self):
        DFTelemetry.objects.create(session=self.session, node_id="DF_001", power_dbm=10.5)
        other_session = TelemetrySession.objects.create(session_name="Other", status=TelemetrySession.STATUS_RUNNING)
        DFTelemetry.objects.create(session=other_session, node_id="DF_002", power_dbm=12.0)

        resp = self.client.get(f"/api/reports/statistical/?session_id={self.session.session_id}")
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertEqual(body["data"]["DF"], 1)
        self.assertEqual(body["data"]["SESSIONS"], 1)

    def test_statistical_report_invalid_session(self):
        resp = self.client.get("/api/reports/statistical/?session_id=00000000-0000-0000-0000-000000000000")
        self.assertEqual(resp.status_code, 404)
        self.assertEqual(resp.json()["status"], "FAILED")

    # ------------------------------------------------------------------
    # Analysis Report
    # ------------------------------------------------------------------
    def test_analysis_report_all_modules(self):
        DFTelemetry.objects.create(session=self.session, node_id="DF_001", power_dbm=10.0)
        DFTelemetry.objects.create(session=self.session, node_id="DF_002", power_dbm=20.0)
        DroneTelemetry.objects.create(session=self.session, drone_id="DRONE_001", drone_altitude=100.0)

        resp = self.client.get("/api/reports/analysis/")
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertEqual(body["status"], "SUCCESS")
        self.assertIn("DF", body["data"])
        self.assertIn("DRONE", body["data"])
        self.assertEqual(body["data"]["DF"]["count"], 2)
        self.assertEqual(body["data"]["DF"]["avg"], 15.0)

    def test_analysis_report_single_module(self):
        DFTelemetry.objects.create(session=self.session, node_id="DF_001", power_dbm=10.0)
        DFTelemetry.objects.create(session=self.session, node_id="DF_002", power_dbm=20.0)

        resp = self.client.get("/api/reports/analysis/?module=DF")
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertEqual(body["status"], "SUCCESS")
        self.assertIn("DF", body["data"])
        self.assertNotIn("DRONE", body["data"])

    def test_analysis_report_invalid_module(self):
        resp = self.client.get("/api/reports/analysis/?module=INVALID")
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(resp.json()["status"], "FAILED")

    def test_analysis_report_invalid_session(self):
        resp = self.client.get("/api/reports/analysis/?session_id=00000000-0000-0000-0000-000000000000")
        self.assertEqual(resp.status_code, 404)

    # ------------------------------------------------------------------
    # CSV Export
    # ------------------------------------------------------------------
    def test_csv_export_with_data(self):
        DroneTelemetry.objects.create(
            session=self.session,
            drone_id="DRONE_001",
            drone_status="UP",
            drone_latitude=18.52,
            drone_longitude=73.85,
        )
        resp = self.client.post(
            "/api/export/csv/",
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

    def test_csv_export_empty_fields_uses_all(self):
        DFTelemetry.objects.create(session=self.session, node_id="DF_001", power_dbm=10.0)
        resp = self.client.post(
            "/api/export/csv/",
            {
                "session_id": str(self.session.session_id),
                "module": "DF",
                "selected_fields": [],
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 200)
        self.assertGreaterEqual(resp.json()["data"]["exported_records"], 1)

    def test_csv_export_missing_session_id(self):
        resp = self.client.post(
            "/api/export/csv/",
            {"module": "DF", "selected_fields": ["node_id"]},
            format="json",
        )
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(resp.json()["status"], "FAILED")

    def test_csv_export_invalid_module(self):
        resp = self.client.post(
            "/api/export/csv/",
            {
                "session_id": str(self.session.session_id),
                "module": "INVALID",
                "selected_fields": [],
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(resp.json()["status"], "FAILED")

    def test_csv_export_invalid_fields(self):
        resp = self.client.post(
            "/api/export/csv/",
            {
                "session_id": str(self.session.session_id),
                "module": "DRONE",
                "selected_fields": ["nonexistent_field"],
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(resp.json()["status"], "FAILED")
