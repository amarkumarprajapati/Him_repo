from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.http import HttpResponse
from django.urls import include, path, re_path
from django.views.static import serve
from drf_spectacular.views import (
    SpectacularAPIView,
)


def scalar_ui_view(request):
    html = """
    <!DOCTYPE html>
    <html>
      <head>
        <title>Himshravan V1 EWCPS — API Reference</title>
        <meta charset=\"utf-8\" />
        <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />
      </head>
      <body>
        <script id=\"api-reference\" data-url=\"/api/schema/\"></script>
        <script src=\"https://cdn.jsdelivr.net/npm/@scalar/api-reference\"></script>
      </body>
    </html>
    """
    return HttpResponse(html)


def root_view(request):
    return HttpResponse(
        "<h1>Himshravan V1 EWCPS Backend</h1>"
        "<ul>"
        '<li><a href="/api/docs/">Scalar</a></li>'
        '<li><a href="/api/schema/">OpenAPI Schema</a></li>'
        '<li><a href="/admin/">Django Admin</a></li>'
        "</ul>"
    )


urlpatterns = [
    path("", root_view, name="root"),
    path("admin/", admin.site.urls),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", scalar_ui_view, name="scalar-ui"),
    path("api/auth/", include("authentication.urls")),
    path("api/", include("session_manager.urls")),
    path("api/", include("device.urls")),
    path("api/", include("telemetry.urls")),
    path("api/", include("synchronization.urls")),
    path("api/", include("events.urls")),
    path("api/", include("reports.urls")),
    path("api/", include("notifications.urls")),
]


if settings.DEBUG:
    urlpatterns += static("/exports/", document_root=str(settings.EXPORTS_DIR))

urlpatterns += [
    re_path(r'^static/(?P<path>.*)$', serve, {'document_root': settings.STATIC_ROOT}),
]
