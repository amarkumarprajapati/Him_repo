from django.utils import timezone
from rest_framework import status
from rest_framework.response import Response


def success_response(data=None, message="Success", http_status=status.HTTP_200_OK):
    response_data = {"status": "SUCCESS", "message": message}
    if data is not None:
        response_data["data"] = data
    return Response(response_data, status=http_status)


def error_response(
    error_code="ERROR",
    message="An error occurred",
    http_status=status.HTTP_400_BAD_REQUEST,
    subsystem=None,
    node_id=None,
):
    payload = {
        "status": "FAILED",
        "error_code": error_code,
        "message": message,
        "timestamp": timezone.now().isoformat(),
    }
    if subsystem:
        payload["subsystem"] = subsystem
    if node_id:
        payload["node_id"] = node_id
    return Response(payload, status=http_status)


def paginated_response(paginator, data, message="Success"):
    response_data = {
        "status": "SUCCESS",
        "message": message,
        "count": paginator.page.paginator.count,
        "total_pages": paginator.page.paginator.num_pages,
        "current_page": paginator.page.number,
        "results": data,
    }
    return Response(response_data)
