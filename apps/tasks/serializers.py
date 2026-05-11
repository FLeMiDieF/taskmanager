from rest_framework import serializers
from .models import Task
from apps.users.serializers import UserSerializer


class TaskSerializer(serializers.ModelSerializer):
    assignee = UserSerializer(read_only=True)
    created_by = UserSerializer(read_only=True)
    assignee_id = serializers.PrimaryKeyRelatedField(
        write_only=True, allow_null=True, required=False,
        queryset=__import__("django.contrib.auth", fromlist=["get_user_model"]).get_user_model().objects.all(),
        source="assignee"
    )

    class Meta:
        model = Task
        fields = ("id", "title", "description", "status", "priority",
                  "project", "assignee", "assignee_id", "created_by",
                  "deadline", "created_at", "updated_at")
        read_only_fields = ("created_by", "created_at", "updated_at")

    def create(self, validated_data):
        validated_data["created_by"] = self.context["request"].user
        return super().create(validated_data)
