"""Publish-on-approval: write canonical records to readable Markdown/YAML files
(the preservation copy). Git commit is left to an external step for now; files
land under CONTENT_REPO_DIR and each write records a PublishedFile row."""
from __future__ import annotations

import hashlib
import os
from pathlib import Path

from django.conf import settings
from django.utils import timezone

from .models import PublishedFile

CONTENT_DIR = Path(os.getenv("CONTENT_REPO_DIR", str(settings.BASE_DIR / "content_repo")))


def _write(rel_path: str, text: str, entity_type: str, entity_id: str) -> PublishedFile:
    path = CONTENT_DIR / rel_path
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")
    digest = hashlib.sha256(text.encode("utf-8")).hexdigest()
    pf, _ = PublishedFile.objects.update_or_create(
        entity_type=entity_type,
        entity_id=entity_id,
        repo_path=rel_path,
        defaults={
            "content_hash": digest,
            "status": PublishedFile.Status.COMMITTED,
            "published_at": timezone.now(),
        },
    )
    return pf


def publish_kalam(kalam) -> list[PublishedFile]:
    """Emit kalam.md (frontmatter + story) and lines.yaml (verses)."""
    author = kalam.author.name if kalam.author_id else ""
    front = (
        "---\n"
        f"title: {kalam.title}\n"
        f"title_native: {kalam.title_native}\n"
        f"slug: {kalam.slug}\n"
        f"author: {author}\n"
        "---\n\n"
        f"{kalam.summary}\n"
    )
    files = [_write(f"kalam/{kalam.slug}/kalam.md", front, "kalam", str(kalam.id))]

    lines = ["# verses"]
    for v in kalam.verses.all().order_by("order"):
        lines.append(f"- order: {v.order}")
        lines.append(f"  text_native: {v.text_native!r}")
        lines.append(f"  transliteration: {v.transliteration!r}")
        if v.translations:
            lines.append(f"  translations: {v.translations!r}")
    files.append(_write(f"kalam/{kalam.slug}/lines.yaml", "\n".join(lines) + "\n", "kalam_lines", str(kalam.id)))
    return files
