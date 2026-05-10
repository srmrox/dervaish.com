"""WSGI config for the Dervaish backend."""

import os

from django.core.wsgi import get_wsgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "dervaish_backend.settings")

application = get_wsgi_application()
