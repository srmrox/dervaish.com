"""Render dispatch. The actual render runs on the LOCAL i9/RTX 5090 worker (the
Lyrics Video renderer) subscribed to the same Celery broker: it claims queued
jobs, renders with MoviePy/NVENC, uploads the MP4 to R2, and calls back to set
`output_url` + status=completed. This task is the entrypoint / placeholder."""
from __future__ import annotations

from celery import shared_task

from .models import VideoGenerationJob
from .services import build_render_payload


@shared_task
def render_video_job(job_id: int) -> int:
    job = VideoGenerationJob.objects.get(id=job_id)
    if job.status == VideoGenerationJob.Status.CANCELLED:
        return job.id
    job.render_payload = build_render_payload(job)
    job.status = VideoGenerationJob.Status.RUNNING
    job.log = (job.log + "\n" if job.log else "") + "Payload built; awaiting local 5090 worker."
    job.save(update_fields=["render_payload", "status", "log", "updated_at"])
    # NOTE: no local render here — the external GPU worker completes the job.
    return job.id
