from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.generics import ListAPIView
from rest_framework.permissions import IsAuthenticated

from core.pagination import StandardResultsSetPagination
from core.response import error_response, success_response

from .models import Notification
from .serializers import NotificationSerializer


class NotificationListView(ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = NotificationSerializer
    pagination_class = StandardResultsSetPagination
    queryset = Notification.objects.all()

    def get_queryset(self):
        queryset = super().get_queryset()
        category = self.request.query_params.get("category")
        status_filter = self.request.query_params.get("status")
        priority = self.request.query_params.get("priority")
        is_read = self.request.query_params.get("is_read")

        if category:
            queryset = queryset.filter(category__iexact=category)
        if status_filter:
            queryset = queryset.filter(status__iexact=status_filter)
        if priority:
            queryset = queryset.filter(priority__iexact=priority)
        if is_read is not None:
            is_read_bool = is_read.lower() in ("1", "true", "yes")
            target_status = Notification.STATUS_READ if is_read_bool else Notification.STATUS_UNREAD
            queryset = queryset.filter(status=target_status)

        return queryset

    def get_paginated_response(self, data):
        response = super().get_paginated_response(data)
        response.data["status"] = "SUCCESS"
        response.data["message"] = "Success"
        return response


@extend_schema(
    parameters=[
        OpenApiParameter("notification_id", type=str, description="UUID of the notification", required=True),
    ],
    responses={200: NotificationSerializer},
    description="Retrieve a single notification by its UUID.",
)
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_notification(request, notification_id):
    try:
        notification = Notification.objects.get(notification_id=notification_id)
    except Notification.DoesNotExist:
        return error_response(message="Notification not found", http_status=status.HTTP_404_NOT_FOUND)
    return success_response(
        data=NotificationSerializer(notification).data,
        message="Notification retrieved successfully",
    )


@extend_schema(
    parameters=[
        OpenApiParameter("notification_id", type=str, description="UUID of the notification", required=True),
    ],
    request=None,
    responses={200: NotificationSerializer},
    description="Mark a notification as read.",
)
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def mark_notification_read(request, notification_id):
    try:
        notification = Notification.objects.get(notification_id=notification_id)
    except Notification.DoesNotExist:
        return error_response(message="Notification not found", http_status=status.HTTP_404_NOT_FOUND)

    notification.mark_as_read()
    return success_response(
        data=NotificationSerializer(notification).data,
        message="Notification marked as read",
    )


@extend_schema(
    parameters=[
        OpenApiParameter("category", type=str, description="Filter by category", required=False),
    ],
    request=None,
    responses={200: OpenApiTypes.OBJECT},
    description="Mark all notifications as read. Optionally filter by category.",
)
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def mark_all_read(request):
    category = request.query_params.get("category")
    queryset = Notification.objects.filter(status=Notification.STATUS_UNREAD)
    if category:
        queryset = queryset.filter(category__iexact=category)
    count = queryset.count()
    queryset.update(status=Notification.STATUS_READ)
    return success_response(
        data={"marked_count": count},
        message=f"{count} notification(s) marked as read",
    )
