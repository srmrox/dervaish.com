from django.conf import settings
from django.contrib import admin
from django.db import connection
from django.http import JsonResponse
from django.urls import include, path


def healthz(_request):
    """Liveness + DB readiness probe for Coolify / load balancers."""
    db_ok = True
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()
    except Exception:  # pragma: no cover - reported, not raised
        db_ok = False
    status = 200 if db_ok else 503
    return JsonResponse(
        {"status": "ok" if db_ok else "degraded", "database": db_ok, "service": "dervaish-api"},
        status=status,
    )


urlpatterns = [
    path("healthz", healthz, name="healthz"),
    path("admin/", admin.site.urls),
    path("api/", include("config.api")),
    path("rest/", include("subsonic.urls")),  # OpenSu