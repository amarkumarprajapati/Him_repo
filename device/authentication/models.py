from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    ROLE_SUPER_ADMIN = "SUPER_ADMIN"
    ROLE_COMMAND_OPERATOR = "COMMAND_OPERATOR"
    ROLE_FIELD_OPERATOR = "FIELD_OPERATOR"

    ROLE_CHOICES = [
        (ROLE_SUPER_ADMIN, "Admin"),
        (ROLE_FIELD_OPERATOR, "Operator"),
    ]

    role = models.CharField(
        max_length=32,
        choices=ROLE_CHOICES,
        default=ROLE_FIELD_OPERATOR,
        help_text="User role determining access permissions",
    )
    assigned_node_id = models.CharField(
        max_length=100,
        blank=True,
        default="",
        help_text="Optional node binding for FIELD_OPERATOR role",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "auth_users"
        verbose_name = "User"
        verbose_name_plural = "Users"

    def __str__(self):
        return f"{self.username} ({self.role})"

    def save(self, *args, **kwargs):
        if self.is_superuser and not self.role:
            self.role = self.ROLE_SUPER_ADMIN
        super().save(*args, **kwargs)

    @property
    def is_super_admin(self):
        return self.is_superuser or self.role == self.ROLE_SUPER_ADMIN

    @property
    def is_command_operator(self):
        return self.is_super_admin or self.role == self.ROLE_COMMAND_OPERATOR

    @property
    def is_field_operator(self):
        return self.is_super_admin or self.role == self.ROLE_FIELD_OPERATOR

    def has_admin_privileges(self):
        return self.is_super_admin

    def has_operator_privileges(self):
        return self.is_command_operator

    def has_viewer_privileges(self):
        return self.is_field_operator or self.is_command_operator
