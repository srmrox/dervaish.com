from django.test import TestCase

from accounts.models import Role, RoleKind, User


class AccountsSmokeTests(TestCase):
    def test_user_and_role_model_support_phase_one_roles(self):
        Role.objects.create(code=RoleKind.EDITOR, name="Editor")
        user = User.objects.create_user(username="editor", password="test", role=RoleKind.EDITOR)

        self.assertEqual(str(user), "editor")
        self.assertEqual(Role.objects.get(code=RoleKind.EDITOR).name, "Editor")
