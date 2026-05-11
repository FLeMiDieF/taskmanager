from rest_framework import viewsets, permissions, filters
from django_filters.rest_framework import DjangoFilterBackend
from .models import Task
from .serializers import TaskSerializer
from apps.notifications.tasks import notify_task_update


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

    def perform_update(self, serializer):
        task = serializer.save()
        notify_task_update.delay(task.id)
