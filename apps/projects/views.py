from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.contrib.auth import get_user_model
from .models import Project
from .serializers import ProjectSerializer
from apps.users.serializers import UserSerializer

User = get_user_model()


class IsOwnerOrMember(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        return request.user == obj.owner or request.user in obj.members.all()


class ProjectViewSet(viewsets.ModelViewSet):
    serializer_class = ProjectSerializer
    permission_classes = (permissions.IsAuthenticated,)

    def get_queryset(self):
        return Project.objects.filter(
            owner=self.request.user
        ) | Project.objects.filter(members=self.request.user)

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

    @action(detail=True, methods=["get", "post"], url_path="members")
    def members(self, request, pk=None):
        project = self.get_object()

        if request.method == "GET":
            data = UserSerializer(project.members.all(), many=True).data
            # Добавляем владельца первым отдельно
            return Response({
                "owner": UserSerializer(project.owner).data,
                "members": data,
            })

        # POST — добавить участника (только владелец)
        if request.user != project.owner:
            return Response(
                {"detail": "Только владелец может добавлять участников."},
                status=status.HTTP_403_FORBIDDEN,
            )
        email = request.data.get("email", "").strip()
        if not email:
            return Response({"detail": "Укажите email."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            return Response({"detail": "Пользователь с таким email не найден."}, status=status.HTTP_404_NOT_FOUND)
        if user == project.owner:
            return Response({"detail": "Этот пользователь является владельцем проекта."}, status=status.HTTP_400_BAD_REQUEST)
        if project.members.filter(id=user.id).exists():
            return Response({"detail": "Пользователь уже является участником."}, status=status.HTTP_400_BAD_REQUEST)
        project.members.add(user)
        return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["delete"], url_path=r"members/(?P<user_id>[^/.]+)")
    def remove_member(self, request, pk=None, user_id=None):
        project = self.get_object()
        if request.user != project.owner:
            return Response(
                {"detail": "Только владелец может удалять участников."},
                status=status.HTTP_403_FORBIDDEN,
            )
        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        project.members.remove(user)
        return Response(status=status.HTTP_204_NO_CONTENT)
