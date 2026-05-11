from django.urls import re_path
from .consumers import TaskConsumer

websocket_urlpatterns = [
    re_path(r"ws/projects/(?P<project_id>\d+)/tasks/$", TaskConsumer.as_asgi()),
]
