"""ASGI config for the Dervaish backend."""

import os

from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "dervaish_backend.settings")

application = get_asgi_application()
