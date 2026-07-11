from __future__ import annotations

from rest_framework.permissions import BasePermission


class IsEditor(BasePermission):
    """Allow only editors and admins (by the accounts.User.role field)."""

    def has_permission(self, request, view) -> bool:
        user = request.user
        return bool(
            user and user.is_authenticated and getattr(user, "role", "") in ("editor", "admin")
        )
