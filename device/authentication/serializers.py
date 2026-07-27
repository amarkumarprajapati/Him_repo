from django.contrib.auth import get_user_model
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

User = get_user_model()


class RoleTokenObtainPairSerializer(TokenObtainPairSerializer):

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        role = user.role or (User.ROLE_SUPER_ADMIN if user.is_superuser else User.ROLE_FIELD_OPERATOR)
        token["role"] = role
        token["username"] = user.username
        return token

    def validate(self, attrs):
        username = attrs.get(self.username_field)
        password = attrs.get("password")

        try:
            user = User.objects.get(**{User.USERNAME_FIELD: username})
        except User.DoesNotExist as err:
            raise serializers.ValidationError({"username": ["Username does not exist."]}) from err

        if not user.check_password(password):
            raise serializers.ValidationError({"password": ["Password is incorrect."]}) from None

        if not user.is_active:
            raise serializers.ValidationError({"username": ["User account is disabled."]})

        data = super().validate(attrs)
        role = self.user.role or (User.ROLE_SUPER_ADMIN if self.user.is_superuser else User.ROLE_FIELD_OPERATOR)

        try:
            from telemetry.models import AuditLog

            AuditLog.objects.create(
                username=self.user.username,
                action_type="LOGIN",
                module_name="authentication",
                status="SUCCESS",
            )
        except Exception:
            pass

        return {
            "status": "SUCCESS",
            "access_token": data["access"],
            "role": role,
            "username": self.user.username,
        }

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "role",
            "assigned_node_id",
            "is_active",
            "last_login",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class UserWriteSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False)

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "password",
            "email",
            "first_name",
            "last_name",
            "role",
            "assigned_node_id",
            "is_active",
        ]

    def validate_role(self, value):
        if value not in [User.ROLE_SUPER_ADMIN, User.ROLE_FIELD_OPERATOR]:
            raise serializers.ValidationError("Invalid role. Role must be either SUPER_ADMIN or FIELD_OPERATOR.")
        return value

    def validate(self, attrs):
        if not self.instance and not attrs.get("password"):
            raise serializers.ValidationError({"password": ["This field is required on creation."]})
        return attrs

    def create(self, validated_data):
        password = validated_data.pop("password", None)
        user = User(**validated_data)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save()
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if password:
            instance.set_password(password)
        instance.save()
        return instance