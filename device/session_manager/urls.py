from django.urls import path

from . import views

app_name = "session_manager"

urlpatterns = [
    path("session/create/", views.create_session, name="session_create_v1"),
    path("session/stop/", views.stop_session, name="session_stop_v1"),
    path("session/status/", views.session_status_v1, name="session_status_v1"),
    path("session/list/", views.list_sessions, name="session_list_v1"),
]
