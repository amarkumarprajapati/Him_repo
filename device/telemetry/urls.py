from django.urls import path

from . import views

app_name = "telemetry"

urlpatterns = [
    # path("telemetry/drone/", views.list_all_drone, name="telemetry-drone-list-all"),
    # path("telemetry/drone/<str:drone_id>/", views.list_drone, name="telemetry-drone-list"),
    path("telemetry/files/", views.device_list, name="Device_list"),
]

