from rest_framework import viewsets, permissions
from .models import Project
from .serializers import ProjectSerializer


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
