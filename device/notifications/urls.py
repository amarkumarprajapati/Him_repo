from django.urls import path

from .views import (
    NotificationListView,
    get_notification,
    mark_all_read,
    mark_notification_read,
)

urlpatterns = [
    path("notifications/", NotificationListView.as_view(), name="notification-list"),
    path("notifications/<uuid:notification_id>/", get_notification, name="notification-detail"),
    path("notifications/<uuid:notification_id>/read/", mark_notification_read, name="notification-mark-read"),
    path("notifications/mark-all-read/", mark_all_read, name="notification-mark-all-read"),
]
