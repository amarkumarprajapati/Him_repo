from django.conf import settings
from django.utils import timezone
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from .models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    created_at = serializers.SerializerMethodField()
    read_at = serializers.SerializerMethodField()

    class Meta:
        model = Notification
        fields = [
            "notification_id",
            "title",
            "message",
            "priority",
            "triggered_by",
            "created_at",
            "read_at",
        ]
        read_only_fields = ["notification_id"]

    @extend_schema_field(serializers.CharField(allow_null=True))
    def get_created_at(self, obj):
        if obj.created_at:
            return timezone.localtime(obj.created_at).strftime(settings.DATETIME_DISPLAY_FORMAT)
        return None

    @extend_schema_field(serializers.CharField(allow_null=True))
    def get_read_at(self, obj):
        if obj.read_at:
            return timezone.localtime(obj.read_at).strftime(settings.DATETIME_DISPLAY_FORMAT)
        return None


class NotificationListResponseSerializer(serializers.Serializer):
    status = serializers.CharField(default="SUCCESS")
    count = serializers.IntegerField()
    next = serializers.URLField(allow_null=True, required=False)
    previous = serializers.URLField(allow_null=True, required=False)
    results = NotificationSerializer(many=True)
