"""Smoke tests for the authentication module."""

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient


class AuthenticationAPITest(TestCase):
    def setUp(self):
        User = get_user_model()
        self.user = User.objects.create_superuser(
            username="admin",
            email="admin@example.com",
            password="admin123",
            role=User.ROLE_SUPER_ADMIN,
        )
        self.client = APIClient()

    # ------------------------------------------------------------------
    # Login
    # ------------------------------------------------------------------
    def test_login_returns_token_and_super_admin_role(self):
        resp = self.client.post(
            "/api/auth/login/",
            {"username": "admin", "password": "admin123"},
            format="json",
        )
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertIn("access_token", body)
        self.assertEqual(body.get("role"), "SUPER_ADMIN")
        self.assertEqual(body.get("username"), "admin")

    def test_login_invalid_password(self):
        resp = self.client.post(
            "/api/auth/login/",
            {"username": "admin", "password": "wrongpassword"},
            format="json",
        )
        self.assertEqual(resp.status_code, 400)

    def test_login_nonexistent_user(self):
        resp = self.client.post(
            "/api/auth/login/",
            {"username": "nobody", "password": "password"},
            format="json",
        )
        self.assertEqual(resp.status_code, 400)

    # ------------------------------------------------------------------
    # Logout
    # ------------------------------------------------------------------
    def test_logout(self):
        login = self.client.post(
            "/api/auth/login/",
            {"username": "admin", "password": "admin123"},
            format="json",
        ).json()
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {login['access_token']}")
        resp = self.client.post("/api/auth/logout/", format="json")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["status"], "SUCCESS")

    def test_logout_requires_auth(self):
        resp = self.client.post("/api/auth/logout/", {}, format="json")
        self.assertEqual(resp.status_code, 401)

    # ------------------------------------------------------------------
    # User Management CRUD
    # ------------------------------------------------------------------
    def test_create_user(self):
        login = self.client.post(
            "/api/auth/login/",
            {"username": "admin", "password": "admin123"},
            format="json",
        ).json()
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {login['access_token']}")
        
        resp = self.client.post(
            "/api/auth/users/",
            {
                "username": "newoperator",
                "password": "OperatorPassword123",
                "email": "operator@example.com",
                "role": "FIELD_OPERATOR",
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.json()["status"], "SUCCESS")
        self.assertEqual(resp.json()["data"]["username"], "newoperator")
        self.assertEqual(resp.json()["data"]["role"], "FIELD_OPERATOR")

    def test_create_user_invalid_role(self):
        login = self.client.post(
            "/api/auth/login/",
            {"username": "admin", "password": "admin123"},
            format="json",
        ).json()
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {login['access_token']}")

        resp = self.client.post(
            "/api/auth/users/",
            {
                "username": "newoperator2",
                "password": "Password123",
                "role": "INVALID_ROLE",
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 400)

    def test_update_user(self):
        login = self.client.post(
            "/api/auth/login/",
            {"username": "admin", "password": "admin123"},
            format="json",
        ).json()
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {login['access_token']}")

        # Create a user first
        User = get_user_model()
        other_user = User.objects.create_user(
            username="otheruser",
            password="oldpassword",
            role="FIELD_OPERATOR"
        )

        resp = self.client.patch(
            f"/api/auth/users/{other_user.id}/",
            {"email": "other@example.com", "role": "SUPER_ADMIN"},
            format="json",
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["data"]["email"], "other@example.com")
        self.assertEqual(resp.json()["data"]["role"], "SUPER_ADMIN")

    def test_delete_user(self):
        login = self.client.post(
            "/api/auth/login/",
            {"username": "admin", "password": "admin123"},
            format="json",
        ).json()
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {login['access_token']}")

        User = get_user_model()
        other_user = User.objects.create_user(
            username="otheruser2",
            password="password",
            role="FIELD_OPERATOR"
        )

        resp = self.client.delete(f"/api/auth/users/{other_user.id}/", format="json")
        self.assertEqual(resp.status_code, 200)
        self.assertFalse(User.objects.filter(id=other_user.id).exists())

    def test_self_deletion_forbidden(self):
        login = self.client.post(
            "/api/auth/login/",
            {"username": "admin", "password": "admin123"},
            format="json",
        ).json()
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {login['access_token']}")

        resp = self.client.delete(f"/api/auth/users/{self.user.id}/", format="json")
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(resp.json()["error_code"], "SELF_DELETION_FORBIDDEN")
