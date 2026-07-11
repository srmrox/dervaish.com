"""
Federation: two registries that let the app (automatically) and the user
(manually) choose where catalogue data and media bytes come from.

- ContentSource  → a Dervaish catalogue/data backend ("database") the app can
  pull from. The official directory lists known sources; users may add custom
  ones. Designed-for-federation; one official source today.
- MediaMirror    → a media-host endpoint (R2/CDN, GitHub raw, etc.) that serves
  the media plane (master plan §4A). Global hosts with on/off + priority.
- MediaAssetMirror → per-asset availability of a file on a non-"carries-all"
  mirror, so the resolver only offers a mirror that actually has the file.

User-level enable/disable and custom additions are held device-side first
(offline-first) and sync to the account later; this module is the *official
directory* + the *automatic resolver*.
"""
from __future__ import annotations

from django.db import models

from common.models import TimestampedModel


class ContentSource(TimestampedModel):
    class Kind(models.TextChoices):
        OFFICIAL = "official", "Official"
        COMMUNITY = "community", "Community"
        PERSONAL = "personal", "Personal"

    name = models.CharField(max_length=160)
    slug = models.SlugField(max_length=180, unique=True)
    # API base for this source's v1 catalogue, e.g. https://api.dervaish.com/api/v1
    base_url = models.URLField(max_length=512)
    description = models.TextField(blank=True)
    kind = models.CharField(max_length=12, choices=Kind.choices, default=Kind.COMMUNITY)
    icon_url = models.URLField(max_length=512, blank=True)

    is_official = models.BooleanField(default=False)  # listed in the official directory
    is_default = models.BooleanField(default=False)   # the app's default source
    is_enabled = models.BooleanField(default=True)    # directory-level availability
    verified = models.BooleanField(default=False)     # trust signal
    priority = models.IntegerField(default=100)       # lower = listed first

    class Meta:
        ordering = ["priority", "name"]

    def __str__(self) -> str:
        return f"{self.name} ({self.get_kind_display()})"


class MediaMirror(TimestampedModel):
    class Kind(models.TextChoices):
        R2 = "r2", "Cloudflare R2 / S3 CDN"
        CDN = "cdn", "Generic CDN"
        GITHUB = "github", "GitHub raw"
        EXTERNAL = "external", "External host"
        LOCAL = "local", "Local / self-hosted"

    name = models.CharField(max_length=160)
    slug = models.SlugField(max_length=180, unique=True)
    # Host root that a media storage_key is appended to, e.g. https://media.dervaish.com
    base_url = models.URLField(max_length=512)
    kind = models.CharField(max_length=12, choices=Kind.choices, default=Kind.CDN)
    notes = models.CharField(max_length=300, blank=True)

    is_official = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)            # admin kill-switch
    is_default_enabled = models.BooleanField(default=True)   # on by default for new clients
    verified = models.BooleanField(default=False)
    # True → hosts the whole catalogue (e.g. the primary R2 CDN); assets are assumed
    # present without explicit availability rows. False → needs a MediaAssetMirror row.
    carries_all = models.BooleanField(default=False)
    priority = models.IntegerField(default=100)             # lower = preferred (automatic order)

    class Meta:
        ordering = ["priority", "name"]

    def __str__(self) -> str:
        return f"{self.name} ({self.get_kind_display()})"

    def url_for(self, storage_key: str) -> str:
        return f"{self.base_url.rstrip('/')}/{storage_key.lstrip('/')}"


class MediaAssetMirror(TimestampedModel):
    """Availability of a specific MediaAsset on a non-carries-all mirror."""

    asset = models.ForeignKey(
        "media.MediaAsset", related_name="mirror_availability", on_delete=models.CASCADE
    )
    mirror = models.ForeignKey(
        MediaMirror, related_name="asset_availability", on_delete=models.CASCADE
    )
    available = models.BooleanField(default=True)
    url_override = models.URLField(max_length=1024, blank=True)  # if path differs on this mirror
    checksum_ok = models.BooleanField(null=True, blank=True)
    last_checked = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["asset", "mirror"], name="unique_asset_mirror"),
        ]

    def __str__(self) -> str:
        return f"asset #{self.asset_id} on {self.mirror.slug}: {'available' if self.available else 'unavailable'}"
