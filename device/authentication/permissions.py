from rest_framework.permissions import BasePermission


class IsSuperAdmin(BasePermission):

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and getattr(user, "is_super_admin", False))


class IsCommandOperator(BasePermission):

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and getattr(user, "is_command_operator", False))


class IsFieldOperatorOrAbove(BasePermission):


    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated)


class IsSuperAdminOrReadOnly(BasePermission):

    def has_permission(self, request, view):
        user = request.user
        if not (user and user.is_authenticated):
            return False
        if request.method in {"GET", "HEAD", "OPTIONS"}:
            return True
        return getattr(user, "is_super_admin", False)
