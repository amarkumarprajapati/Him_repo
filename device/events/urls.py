from django.urls import path

from . import views

app_name = "events"

urlpatterns = [
    path("events/", views.EventListView.as_view(), name="event-list"),
    path("system/health/", views.system_health, name="system-health"),
]
