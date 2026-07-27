"""Smoke tests for the notifications module."""

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from .models import Notification


class NotificationsAPITest(TestCase):
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

        self.notif = Notification.objects.create(
            title="Session created",
            message="Session Alpha was created by admin.",
            category=Notification.CATEGORY_SESSION,
            priority=Notification.PRIORITY_LOW,
            status=Notification.STATUS_UNREAD,
            action_type="CREATE",
            triggered_by="admin",
        )

    # ------------------------------------------------------------------
    # List
    # ------------------------------------------------------------------
    def test_list_notifications(self):
        resp = self.client.get("/api/notifications/")
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertEqual(body["status"], "SUCCESS")
        self.assertGreaterEqual(len(body["results"]), 1)

    def test_list_notifications_filter_by_category(self):
        resp = self.client.get("/api/notifications/?category=SESSION")
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertTrue(all(n["title"] == "Session created" for n in body["results"]))

    def test_list_notifications_filter_by_priority(self):
        resp = self.client.get("/api/notifications/?priority=LOW")
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertTrue(all(n["priority"] == "LOW" for n in body["results"]))

    def test_list_notifications_filter_by_is_read(self):
        resp = self.client.get("/api/notifications/?is_read=false")
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertTrue(all(n.get("read_at") is None for n in body["results"]))

    # ------------------------------------------------------------------
    # Detail
    # ------------------------------------------------------------------
    def test_get_notification_detail(self):
        resp = self.client.get(f"/api/notifications/{self.notif.notification_id}/")
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertEqual(body["status"], "SUCCESS")
        self.assertEqual(body["data"]["title"], "Session created")

    def test_get_notification_detail_not_found(self):
        resp = self.client.get("/api/notifications/00000000-0000-0000-0000-000000000000/")
        self.assertEqual(resp.status_code, 404)

    # ------------------------------------------------------------------
    # Mark Read
    # ------------------------------------------------------------------
    def test_mark_notification_read(self):
        resp = self.client.post(f"/api/notifications/{self.notif.notification_id}/read/")
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertEqual(body["status"], "SUCCESS")
        self.notif.refresh_from_db()
        self.assertEqual(self.notif.status, Notification.STATUS_READ)
        self.assertIsNotNone(self.notif.read_at)

    def test_mark_notification_read_not_found(self):
        resp = self.client.post("/api/notifications/00000000-0000-0000-0000-000000000000/read/")
        self.assertEqual(resp.status_code, 404)

    # ------------------------------------------------------------------
    # Mark All Read
    # ------------------------------------------------------------------
    def test_mark_all_read(self):
        Notification.objects.create(
            title="Another",
            message="msg",
            category=Notification.CATEGORY_SYSTEM,
            status=Notification.STATUS_UNREAD,
        )
        resp = self.client.post("/api/notifications/mark-all-read/")
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertEqual(body["status"], "SUCCESS")
        self.assertGreaterEqual(body["data"]["marked_count"], 2)
        self.assertEqual(Notification.objects.filter(status=Notification.STATUS_UNREAD).count(), 0)

    def test_mark_all_read_filtered_by_category(self):
        Notification.objects.create(
            title="System Alert",
            message="alert",
            category=Notification.CATEGORY_SYSTEM,
            status=Notification.STATUS_UNREAD,
        )
        resp = self.client.post("/api/notifications/mark-all-read/?category=SYSTEM")
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertEqual(body["data"]["marked_count"], 1)
