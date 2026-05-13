from django.urls import re_path
from .consumers import TaskConsumer, UserConsumer

websocket_urlpatterns = [
    re_path(r"ws/projects/(?P<project_id>\d+)/tasks/$", TaskConsumer.as_asgi()),
    re_path(r"ws/users/(?P<user_id>\d+)/$", UserConsumer.as_asgi()),
]
