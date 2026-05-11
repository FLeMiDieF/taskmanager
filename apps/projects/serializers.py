from rest_framework import serializers
from .models import Project
from apps.users.serializers import UserSerializer


class ProjectSerializer(serializers.ModelSerializer):
    owner = UserSerializer(read_only=True)
    members = UserSerializer(many=True, read_only=True)
    member_ids = serializers.PrimaryKeyRelatedField(
        many=True, write_only=True, queryset=__import__("django.contrib.auth", fromlist=["get_user_model"]).get_user_model().objects.all(),
        source="members", required=False
    )

    class Meta:
        model = Project
        fields = ("id", "name", "description", "owner", "members", "member_ids", "created_at")

    def create(self, validated_data):
        members = validated_data.pop("members", [])
        project = Project.objects.create(**validated_data)
        project.members.set(members)
        return project

    def update(self, instance, validated_data):
        members = validated_data.pop("members", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if members is not None:
            instance.members.set(members)
        return instance
