from django.urls import path

from . import views

app_name = "synchronization"

urlpatterns = [
    path("sync/start/", views.sync_start, name="sync-start"),
    path("sync/export/", views.sync_export, name="sync-export"),
    path("sync/status/", views.sync_status_overview, name="sync-status-overview"),
    path("sync/status/node/<str:node_id>/", views.sync_status_node, name="sync-status-node"),
    path("sync/status/drone/<str:drone_id>/", views.sync_status_drone, name="sync-status-drone"),
    path("sync/status/satellite/<str:satellite_id>/", views.sync_status_satellite, name="sync-status-satellite"),
    path(
        "sync/status/passive-cellular/<str:passive_cellular_id>/",
        views.sync_status_passive_cellular,
        name="sync-status-passive-cellular",
    ),
    path(
        "sync/status/active-cellular/<str:active_cellular_id>/",
        views.sync_status_active_cellular,
        name="sync-status-active-cellular",
    ),
]
