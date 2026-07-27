from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ("username", "email", "role", "first_name", "last_name", "is_active", "created_at")
    list_filter = ("role", "is_active", "is_staff", "created_at")
    search_fields = ("username", "email", "first_name", "last_name")
    ordering = ("-created_at",)

    fieldsets = BaseUserAdmin.fieldsets + (("Role Information", {"fields": ("role",)}),)

    add_fieldsets = BaseUserAdmin.add_fieldsets + (("Role Information", {"fields": ("role",)}),)
