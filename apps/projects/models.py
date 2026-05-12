from uuid import uuid4
from django.db import models
from django.conf import settings


class Project(models.Model):
    uuid = models.UUIDField(default=uuid4, unique=True, editable=False)
    invite_token = models.UUIDField(default=uuid4, unique=True)
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="owned_projects")
    members = models.ManyToManyField(settings.AUTH_USER_MODEL, related_name="projects", blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name
