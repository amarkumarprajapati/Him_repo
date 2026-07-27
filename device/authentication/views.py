from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiExample, OpenApiParameter, extend_schema
from django.contrib.auth import get_user_model
from django.db.models import Q
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.generics import ListCreateAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework_simplejwt.views import TokenObtainPairView

from core.pagination import StandardResultsSetPagination
from core.response import error_response, success_response

from .permissions import IsSuperAdmin
from .serializers import RoleTokenObtainPairSerializer, UserSerializer, UserWriteSerializer

User = get_user_model()


@extend_schema(
    tags=["Auth"],
    request=RoleTokenObtainPairSerializer,
    description="Login returns a long-lived JWT access token, role, and username.",
    examples=[
        OpenApiExample(
            "Example",
            value={"username": "admin", "password": "Admin@123"},
            request_only=True,
        )
    ],
)
class LoginView(TokenObtainPairView):
    serializer_class = RoleTokenObtainPairSerializer


@extend_schema(
    tags=["Auth"],
    responses={200: OpenApiTypes.OBJECT},
    description="Logout — client should discard the access token.",
)
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def logout_view(request):
    try:
        from telemetry.models import AuditLog

        AuditLog.objects.create(
            username=request.user.username,
            action_type="LOGOUT",
            module_name="authentication",
            status="SUCCESS",
        )
    except Exception:
        pass
    return success_response(message="Logout successful")


class UserListView(ListCreateAPIView):
    permission_classes = [IsAuthenticated, IsSuperAdmin]
    serializer_class = UserSerializer
    pagination_class = StandardResultsSetPagination
    queryset = User.objects.all().order_by("-created_at")

    def get_serializer_class(self):
        if self.request.method == "POST":
            return UserWriteSerializer
        return UserSerializer

    @extend_schema(
        tags=["Auth"],
        parameters=[
            OpenApiParameter("role", type=str, description="Filter by role"),
            OpenApiParameter("is_active", type=bool, description="Filter by active status"),
            OpenApiParameter("search", type=str, description="Search username, email, or name"),
        ],
        description="List all users with optional filters.",
    )
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

    @extend_schema(
        tags=["Auth"],
        request=UserWriteSerializer,
        responses={201: UserSerializer},
        description="Create a new user.",
    )
    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        # Audit Log
        try:
            from telemetry.models import AuditLog
            AuditLog.objects.create(
                username=request.user.username,
                action_type="CREATE_USER",
                module_name="authentication",
                status="SUCCESS",
            )
        except Exception:
            pass

        return success_response(
            data=UserSerializer(user).data,
            message="User created successfully",
            http_status=status.HTTP_201_CREATED,
        )

    def get_queryset(self):
        qs = super().get_queryset()
        params = self.request.query_params

        role = params.get("role")
        if role:
            qs = qs.filter(role__iexact=role)

        is_active = params.get("is_active")
        if is_active is not None:
            qs = qs.filter(is_active=is_active.lower() in ("1", "true", "yes"))

        search = params.get("search")
        if search:
            qs = qs.filter(
                Q(username__icontains=search)
                | Q(email__icontains=search)
                | Q(first_name__icontains=search)
                | Q(last_name__icontains=search)
            )

        return qs

    def get_paginated_response(self, data):
        response = super().get_paginated_response(data)
        response.data["status"] = "SUCCESS"
        response.data["message"] = "Users retrieved successfully"
        return response


@extend_schema(
    tags=["Auth"],
    methods=["GET"],
    responses={200: UserSerializer},
    description="Retrieve a single user by ID.",
)
@extend_schema(
    tags=["Auth"],
    methods=["PUT", "PATCH"],
    request=UserWriteSerializer,
    responses={200: UserSerializer},
    description="Update a user's details.",
)
@extend_schema(
    tags=["Auth"],
    methods=["DELETE"],
    responses={200: OpenApiTypes.OBJECT},
    description="Delete a user.",
)
@api_view(["GET", "PUT", "PATCH", "DELETE"])
@permission_classes([IsAuthenticated, IsSuperAdmin])
def get_user_detail(request, user_id):
    try:
        user = User.objects.get(pk=user_id)
    except User.DoesNotExist:
        return error_response("USER_NOT_FOUND", "User not found", status.HTTP_404_NOT_FOUND)

    if request.method == "GET":
        return success_response(
            data=UserSerializer(user).data,
            message="User retrieved successfully",
        )

    elif request.method in ("PUT", "PATCH"):
        partial = (request.method == "PATCH")
        serializer = UserWriteSerializer(user, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        updated_user = serializer.save()

        # Audit Log
        try:
            from telemetry.models import AuditLog
            AuditLog.objects.create(
                username=request.user.username,
                action_type="UPDATE_USER",
                module_name="authentication",
                status="SUCCESS",
            )
        except Exception:
            pass

        return success_response(
            data=UserSerializer(updated_user).data,
            message="User updated successfully",
        )

    elif request.method == "DELETE":
        if user == request.user:
            return error_response(
                error_code="SELF_DELETION_FORBIDDEN",
                message="You cannot delete your own account",
                http_status=status.HTTP_400_BAD_REQUEST,
            )

        user.delete()

        # Audit Log
        try:
            from telemetry.models import AuditLog
            AuditLog.objects.create(
                username=request.user.username,
                action_type="DELETE_USER",
                module_name="authentication",
                status="SUCCESS",
            )
        except Exception:
            pass

        return success_response(
            message="User deleted successfully",
        )


@extend_schema(
    tags=["Auth"],
    responses={200: OpenApiTypes.OBJECT},
    description="List all available user roles.",
)
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def list_roles(request):
    roles = [{"value": value, "label": label} for value, label in User.ROLE_CHOICES]
    return success_response(data=roles, message="Roles retrieved successfully")

