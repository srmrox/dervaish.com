"""Role-based DRF permissions (master plan §11.3).

Public reads stay open (the default `AllowAny`); write/review endpoints opt into
these. Roles are ranked (listener < contributor < editor < admin) via
``User.has_role`` so a higher role always satisfies a lower requirement.
"""
from __future__ import annotations

from rest_framework.permissions import SAFE_METHODS, BasePermission

from .models import Role


class _MinRole(BasePermission):
    minimum: str = Role.LISTENER

    def has_permission(self, request, view) -> bool:
        user = request.user
        return bool(user and user.is_authenticated and user.has_role(self.minimum))


class IsContributor(_MinRole):
    minimum = Role.CONTRIBUTOR


class IsEditor(_MinRole):
    minimum = Role.EDITOR


class IsAdminRole(_MinRole):
    minimum = Role.ADMIN


class ReadOnlyOrEditor(BasePermission):
    """Anyone may read; only editors+ may write. For curated/admin-ish endpoints."""

    def has_permission(self, request, view) -> bool:
        if request.method in SAFE_METHODS:
            return True
        user = request.user
        return bool(user and user.is_authenticated and user.has_role(Role.EDITOR))
