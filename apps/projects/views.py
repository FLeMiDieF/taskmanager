from uuid import uuid4
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.contrib.auth import get_user_model
from .models import Project
from .serializers import ProjectSerializer
from apps.users.serializers import UserSerializer
from apps.notifications.tasks import notify_member_update, notify_user_project_update

User = get_user_model()


class IsOwnerOrMember(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        return request.user == obj.owner or request.user in obj.members.all()


class ProjectViewSet(viewsets.ModelViewSet):
    serializer_class = ProjectSerializer
    permission_classes = (permissions.IsAuthenticated,)

    def get_queryset(self):
        qs = (
            Project.objects.filter(owner=self.request.user) |
            Project.objects.filter(members=self.request.user)
        ).distinct()
        # Поиск по UUID (для board.js)
        uuid_param = self.request.query_params.get("uuid")
        if uuid_param:
            qs = qs.filter(uuid=uuid_param)
        return qs

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

    def perform_destroy(self, instance):
        if self.request.user != instance.owner:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Только владелец может удалить проект.")
        instance.delete()

    # ── Участники ────────────────────────────────────────────────

    @action(detail=True, methods=["get", "post"], url_path="members")
    def members(self, request, pk=None):
        project = self.get_object()

        if request.method == "GET":
            return Response({
                "owner": UserSerializer(project.owner).data,
                "members": UserSerializer(project.members.all(), many=True).data,
                "admin_ids": list(project.admins.values_list("id", flat=True)),
            })

        if request.user != project.owner:
            return Response(
                {"detail": "Только владелец может добавлять участников."},
                status=status.HTTP_403_FORBIDDEN,
            )
        username = request.data.get("username", "").strip()
        if not username:
            return Response({"detail": "Укажите имя пользователя."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            user = User.objects.get(username=username)
        except User.DoesNotExist:
            return Response({"detail": "Пользователь не найден."}, status=status.HTTP_404_NOT_FOUND)
        if user == project.owner:
            return Response({"detail": "Этот пользователь является владельцем проекта."}, status=status.HTTP_400_BAD_REQUEST)
        if project.members.filter(id=user.id).exists():
            return Response({"detail": "Пользователь уже является участником."}, status=status.HTTP_400_BAD_REQUEST)
        project.members.add(user)
        notify_member_update.delay(project.id)
        notify_user_project_update.delay(user.id)
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
        project.admins.remove(user)
        notify_member_update.delay(project.id)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"], url_path="leave")
    def leave(self, request, pk=None):
        project = self.get_object()
        if request.user == project.owner:
            return Response(
                {"detail": "Владелец не может покинуть свой проект. Удалите проект."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not project.members.filter(id=request.user.id).exists():
            return Response({"detail": "Вы не являетесь участником этого проекта."}, status=status.HTTP_400_BAD_REQUEST)
        project.members.remove(request.user)
        project.admins.remove(request.user)
        notify_member_update.delay(project.id)
        return Response(status=status.HTTP_204_NO_CONTENT)

    # ── Админы ───────────────────────────────────────────────────

    @action(detail=True, methods=["post", "delete"], url_path=r"admins/(?P<user_id>[^/.]+)")
    def manage_admin(self, request, pk=None, user_id=None):
        """POST — выдать админку, DELETE — снять. Только владелец."""
        project = self.get_object()
        if request.user != project.owner:
            return Response(
                {"detail": "Только владелец может управлять админами."},
                status=status.HTTP_403_FORBIDDEN,
            )
        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        if user == project.owner:
            return Response({"detail": "Владелец и так имеет полные права."}, status=status.HTTP_400_BAD_REQUEST)
        if not project.members.filter(id=user.id).exists():
            return Response({"detail": "Пользователь не является участником."}, status=status.HTTP_400_BAD_REQUEST)

        if request.method == "POST":
            project.admins.add(user)
        else:
            project.admins.remove(user)
        notify_member_update.delay(project.id)
        return Response(status=status.HTTP_204_NO_CONTENT)

    # ── Приглашение по ссылке ─────────────────────────────────────

    @action(detail=False, methods=["get"], url_path=r"invite/(?P<token>[^/.]+)",
            permission_classes=[permissions.AllowAny])
    def invite_info(self, request, token=None):
        """Публичная информация о проекте по инвайт-токену (без авторизации)."""
        try:
            project = Project.objects.get(invite_token=token)
        except (Project.DoesNotExist, Exception):
            return Response({"detail": "Недействительная ссылка."}, status=status.HTTP_404_NOT_FOUND)
        return Response({
            "name": project.name,
            "description": project.description,
            "owner": project.owner.username,
            "members_count": project.members.count() + 1,
        })

    @action(detail=False, methods=["post"], url_path=r"join/(?P<token>[^/.]+)")
    def join(self, request, token=None):
        """Вступить в проект по инвайт-токену."""
        try:
            project = Project.objects.get(invite_token=token)
        except (Project.DoesNotExist, Exception):
            return Response({"detail": "Недействительная ссылка."}, status=status.HTTP_404_NOT_FOUND)
        if request.user == project.owner:
            return Response({"detail": "Вы владелец этого проекта."}, status=status.HTTP_400_BAD_REQUEST)
        if project.members.filter(id=request.user.id).exists():
            return Response({"detail": "Вы уже участник этого проекта."}, status=status.HTTP_400_BAD_REQUEST)
        project.members.add(request.user)
        return Response({
            "detail": f"Вы вступили в проект «{project.name}».",
            "uuid": str(project.uuid),
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], url_path="reset-invite")
    def reset_invite(self, request, pk=None):
        """Сбросить инвайт-токен (старая ссылка перестанет работать)."""
        project = self.get_object()
        if request.user != project.owner:
            return Response({"detail": "Только владелец может сбросить ссылку."}, status=status.HTTP_403_FORBIDDEN)
        project.invite_token = uuid4()
        project.save(update_fields=["invite_token"])
        return Response({"invite_token": str(project.invite_token)})
