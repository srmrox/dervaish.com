"""Celery application for media and preservation background work."""

import os

from celery import Celery

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "dervaish_backend.settings")

app = Celery("dervaish")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()
