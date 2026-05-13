from rest_framework import viewsets, permissions, filters
from rest_framework.exceptions import PermissionDenied, ValidationError
from django_filters.rest_framework import DjangoFilterBackend
from .models import Task
from .serializers import TaskSerializer
from apps.notifications.tasks import notify_task_update
from apps.projects.models import Project


def _check_project_access(user, project_id):
    """Проверяет, является ли пользователь владельцем или участником проекта."""
    try:
        project = Project.objects.get(id=project_id)
    except Project.DoesNotExist:
        raise ValidationError({"project": "Проект не найден."})
    if project.owner != user and not project.members.filter(id=user.id).exists():
        raise PermissionDenied("У вас нет доступа к этому проекту.")
    return project


class TaskViewSet(viewsets.ModelViewSet):
    serializer_class = TaskSerializer
    permission_classes = (permissions.IsAuthenticated,)
    filter_backends = (DjangoFilterBackend, filters.OrderingFilter)
    filterset_fields = ("status", "priority", "project", "assignee")
    ordering_fields = ("deadline", "created_at", "priority")

    def get_queryset(self):
        return Task.objects.filter(
            project__owner=self.request.user
        ) | Task.objects.filter(
            project__members=self.request.user
        )

    def perform_create(self, serializer):
        project_id = self.request.data.get("project")
        _check_project_access(self.request.user, project_id)
        task = serializer.save()
        notify_task_update.delay(task.id)

    def perform_update(self, serializer):
        project = serializer.instance.project
        if not project.is_admin(self.request.user):
            raise PermissionDenied("Только админ или владелец может изменять задачи.")
        task = serializer.save()
        notify_task_update.delay(task.id)

    def perform_destroy(self, instance):
        project = instance.project
        if not project.is_admin(self.request.user):
            raise PermissionDenied("Только админ или владелец может удалять задачи.")
        project_id = instance.project_id
        task_id = instance.id
        instance.delete()
        notify_task_update.delay(task_id, project_id)
