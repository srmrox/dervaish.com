from django.contrib.auth.models import AbstractUser
from django.db import models

from common.models import TimestampedModel


class RoleKind(models.TextChoices):
    ANONYMOUS = "anonymous", "Anonymous"
    LISTENER = "listener", "Listener"
    CONTRIBUTOR = "contributor", "Contributor"
    EDITOR = "editor", "Editor"
    ADMIN = "admin", "Admin"


class Role(TimestampedModel):
    code = models.CharField(max_length=24, choices=RoleKind.choices, unique=True)
    name = models.CharField(max_length=80)
    description = models.TextField(blank=True)

    class Meta:
        ordering = ["code"]

    def __str__(self) -> str:
        return self.name


class User(AbstractUser):
    display_name = models.CharField(max_length=160, blank=True)
    role = models.CharField(max_length=24, choices=RoleKind.choices, default=RoleKind.LISTENER)
    trust_score = models.PositiveIntegerField(default=0)

    def __str__(self) -> str:
        return self.display_name or self.username
