from django.urls import path

from . import views

app_name = "device"

urlpatterns = [
    path("device/discover/", views.discover_device, name="device_discover_v1"),
    path("device/list/", views.list_devices, name="device_list_v1"),
    path("device/regions/", views.list_regions, name="device_regions_v1"),
    path("device/get_sensor/", views.get_sensor, name="device_sync_nodes_v1"),
    path("device/ping-nodes/", views.ping_nodes, name="device_ping_nodes_v1"),
]