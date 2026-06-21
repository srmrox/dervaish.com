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

    def __str__(self) -> str:
        return self.display_name or self.get_username()
