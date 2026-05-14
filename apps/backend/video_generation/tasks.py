from celery import shared_task
from django.utils import timezone

from .models import VideoGenerationJob, VideoGenerationStatus
from .services import build_render_payload, complete_render_placeholder


@shared_task(bind=True, autoretry_for=(), max_retries=0)
def render_video_generation_job(self, job_id: int) -> int:
    job = VideoGenerationJob.objects.select_related("source_asset", "lyric_set", "track", "requested_by").get(id=job_id)
    if job.status == VideoGenerationStatus.CANCELLED:
        return job.id
    job.status = VideoGenerationStatus.RUNNING
    job.celery_task_id = self.request.id or job.celery_task_id
    job.render_payload = job.render_payload or build_render_payload(job)
    job.log = (job.log + "\n" if job.log else "") + f"Render started at {timezone.now().isoformat()}."
    job.save(update_fields=["status", "celery_task_id", "render_payload", "log", "updated_at"])
    try:
        complete_render_placeholder(job)
    except Exception as exc:
        job.status = VideoGenerationStatus.FAILED
        job.failure_reason = str(exc)
        job.log = (job.log + "\n" if job.log else "") + f"Render failed: {exc}"
        job.save(update_fields=["status", "failure_reason", "log", "updated_at"])
        raise
    return job.id
