from django.contrib.auth.models import AbstractUser
from django.db import models


class Role(models.TextChoices):
    LISTENER = "listener", "Listener"
    CONTRIBUTOR = "contributor", "Contributor"
    EDITOR = "editor", "Editor"
    ADMIN = "admin", "Admin"


class User(AbstractUser):
    """Custom user so we can add roles/trust without a later painful migration."""

    role = models.CharField(max_length=16, choices=Role.choices, default=Role.LISTENER)
    trust_score = models.PositiveIntegerField(default=0)
    display_name = models.CharField(max_length=120, blank=True)
    # Free-form client preferences (visible lyric lanes, theme, autoplay…), synced
    # across devices. Schema is owned by the client; the API just persists it.
    preferences = models.JSONField(default=dict, blank=True)

    # Role ranking for permission checks (higher = more capable).
    _RANK = {Role.LISTENER: 1, Role.CONTRIBUTOR: 2, Role.EDITOR: 3, Role.ADMIN: 4}

    def __str__(self) -> str:
        return self.display_name or self.get_username()

    def has_role(self, minimum: str) -> bool:
        """True if this user's role is at least ``minimum`` in the role hierarchy."""
        return self._RANK.get(self.role, 0) >= self._RANK.get(minimum, 99)
