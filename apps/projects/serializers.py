from rest_framework import serializers
from .models import Project
from apps.users.serializers import UserSerializer


class ProjectSerializer(serializers.ModelSerializer):
    owner = UserSerializer(read_only=True)
    members = UserSerializer(many=True, read_only=True)
    member_ids = serializers.PrimaryKeyRelatedField(
        many=True, write_only=True,
        queryset=__import__("django.contrib.auth", fromlist=["get_user_model"]).get_user_model().objects.all(),
        source="members", required=False
    )
    # invite_token видит только владелец (проверяется в to_representation)
    invite_token = serializers.UUIDField(read_only=True)

    class Meta:
        model = Project
        fields = ("id", "uuid", "name", "description", "owner", "members",
                  "member_ids", "invite_token", "created_at")

    def to_representation(self, instance):
        data = super().to_representation(instance)
        request = self.context.get("request")
        # Скрываем invite_token от не-владельцев
        if request and request.user != instance.owner:
            data.pop("invite_token", None)
        return data

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
