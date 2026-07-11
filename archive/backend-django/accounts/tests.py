from __future__ import annotations

from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

User = get_user_model()


class AuthFlowTests(APITestCase):
    def test_register_returns_token_and_user(self):
        resp = self.client.post(
            "/api/v1/auth/register/",
            {"username": "amina", "password": "a-strong-pass-123", "display_name": "Amina"},
            format="json",
        )
        self.assertEqual(resp.status_code, 201)
        self.assertIn("token", resp.data)
        self.assertEqual(resp.data["user"]["username"], "amina")
        self.assertEqual(resp.data["user"]["role"], "listener")

    def test_login_then_me(self):
        User.objects.create_user(username="b", password="a-strong-pass-123")
        login = self.client.post(
            "/api/v1/auth/login/", {"username": "b", "password": "a-strong-pass-123"}, format="json"
        )
        self.assertEqual(login.status_code, 200)
        token = login.data["token"]

        # /me/ requires auth
        self.assertEqual(self.client.get("/api/v1/me/").status_code, 401)

        self.client.credentials(HTTP_AUTHORIZATION=f"Token {token}")
        me = self.client.get("/api/v1/me/")
        self.assertEqual(me.status_code, 200)
        self.assertEqual(me.data["username"], "b")

    def test_preferences_merge(self):
        user = User.objects.create_user(username="c", password="a-strong-pass-123")
        self.client.force_authenticate(user)
        self.client.patch("/api/v1/me/preferences/", {"preferences": {"theme": "dark"}}, format="json")
        resp = self.client.patch(
            "/api/v1/me/preferences/", {"preferences": {"autoplay": True}}, format="json"
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["preferences"], {"theme": "dark", "autoplay": True})

    def test_logout_invalidates_token(self):
        User.objects.create_user(username="d", password="a-strong-pass-123")
        login = self.client.post(
            "/api/v1/auth/login/", {"username": "d", "password": "a-strong-pass-123"}, format="json"
        )
        token = login.data["token"]
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {token}")
        self.assertEqual(self.client.post("/api/v1/auth/logout/").status_code, 204)
        # token no longer works
        self.assertEqual(self.client.get("/api/v1/me/").status_code, 401)

    def test_has_role_hierarchy(self):
        editor = User.objects.create_user(username="e", password="x", role="editor")
        self.assertTrue(editor.has_role("contributor"))
        self.assertTrue(editor.has_role("editor"))
        self.assertFalse(editor.has_role("admin"))
