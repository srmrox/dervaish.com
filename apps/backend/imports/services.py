from __future__ import annotations

from django.db import transaction

from archive.models import ArchiveRecord, Citation, ProvenanceRecord
from catalog.models import Collection, Person, Track
from common.models import EditorialState
from media.models import MediaAsset, MediaKind, ProcessingStatus

from .models import ImportBatch, ImportBatchStatus


def preview_import(source: str, payload: dict) -> dict:
    items = payload.get("items", payload.get("records", payload.get("media", [])))
    if not isinstance(items, list):
        items = []
    return {
        "source": source,
        "item_count": len(items),
        "track_candidates": sum(1 for item in items if item.get("type") in {"track", "media", "item"}),
        "archive_candidates": sum(1 for item in items if item.get("metadata") or item.get("values")),
        "media_candidates": sum(1 for item in items if item.get("media") or item.get("file") or item.get("url")),
    }


@transaction.atomic
def run_import_batch(batch: ImportBatch) -> ImportBatch:
    if batch.dry_run:
        batch.status = ImportBatchStatus.DRY_RUN
        batch.summary = preview_import(batch.source, batch.payload)
        batch.save(update_fields=["status", "summary", "updated_at"])
        return batch

    try:
        if batch.source == "dervaish_prototype":
            summary = import_dervaish_prototype(batch.payload)
        elif batch.source == "mediacms":
            summary = import_mediacms(batch.payload)
        elif batch.source == "omeka_s":
            summary = import_omeka_s(batch.payload)
        else:
            raise ValueError(f"Unsupported import source: {batch.source}")
        batch.status = ImportBatchStatus.COMPLETED
        batch.summary = summary
        batch.error = ""
    except Exception as exc:
        batch.status = ImportBatchStatus.FAILED
        batch.error = str(exc)
    batch.save(update_fields=["status", "summary", "error", "updated_at"])
    return batch


def import_dervaish_prototype(payload: dict) -> dict:
    created = {"tracks": 0, "people": 0, "collections": 0, "archive_records": 0}
    for person_data in payload.get("people", []):
        _, was_created = Person.objects.get_or_create(
            slug=person_data["slug"],
            defaults={
                "name": person_data["name"],
                "visibility": EditorialState.PENDING_REVIEW,
                "primary_role": person_data.get("primary_role", "contributor"),
            },
        )
        created["people"] += int(was_created)
    for collection_data in payload.get("collections", []):
        _, was_created = Collection.objects.get_or_create(
            slug=collection_data["slug"],
            defaults={"title": collection_data["title"], "visibility": EditorialState.PENDING_REVIEW, "is_curated": collection_data.get("is_curated", False)},
        )
        created["collections"] += int(was_created)
    for track_data in payload.get("tracks", []):
        collection = Collection.objects.filter(slug=track_data.get("collection_slug", "")).first()
        _, was_created = Track.objects.get_or_create(
            slug=track_data["slug"],
            defaults={
                "title": track_data["title"],
                "duration_ms": track_data.get("duration_ms", 0),
                "primary_language_code": track_data.get("primary_language_code", "ur"),
                "visibility": EditorialState.PENDING_REVIEW,
                "collection": collection,
            },
        )
        created["tracks"] += int(was_created)
    return created


def import_mediacms(payload: dict) -> dict:
    created = {"media_assets": 0}
    for media_data in payload.get("media", payload.get("items", [])):
        title = media_data.get("title") or media_data.get("name") or "Imported MediaCMS media"
        source_url = media_data.get("url") or media_data.get("media_file") or ""
        _, was_created = MediaAsset.objects.get_or_create(
            source_url=source_url,
            defaults={
                "title": title,
                "kind": media_data.get("kind", MediaKind.VIDEO),
                "storage_key": media_data.get("storage_key", f"imports/mediacms/{title}"),
                "mime_type": media_data.get("mime_type", ""),
                "duration_ms": media_data.get("duration_ms", 0),
                "status": ProcessingStatus.PENDING,
                "metadata": {"imported_from": "mediacms", "source": media_data},
            },
        )
        created["media_assets"] += int(was_created)
    return created


def import_omeka_s(payload: dict) -> dict:
    created = {"archive_records": 0, "citations": 0, "provenance_records": 0}
    for item in payload.get("items", payload.get("records", [])):
        slug = item.get("slug") or f"omeka-item-{item.get('id')}"
        title = item.get("title") or item.get("o:title") or "Imported Omeka item"
        record, was_created = ArchiveRecord.objects.get_or_create(
            slug=slug,
            defaults={"title": title, "summary": item.get("summary", item.get("description", "")) or title, "visibility": EditorialState.PENDING_REVIEW},
        )
        created["archive_records"] += int(was_created)
        source_url = item.get("url") or item.get("@id", "")
        if source_url:
            citation, citation_created = Citation.objects.get_or_create(
                url=source_url,
                defaults={"title": f"Original Omeka item: {title}", "source_type": "website", "note": "Imported source reference."},
            )
            record.citations.add(citation)
            created["citations"] += int(citation_created)
        ProvenanceRecord.objects.get_or_create(
            archive_record=record,
            event_type="imported",
            source_identifier=str(item.get("id", "")),
            defaults={"source_name": "Omeka S", "source_url": source_url, "metadata": {"source": item}},
        )
        created["provenance_records"] += 1
    return created
