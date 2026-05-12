from django.urls import path
from .views import RegisterView, MeView, UserSearchView

urlpatterns = [
    path("auth/register/", RegisterView.as_view(), name="register"),
    path("users/me/", MeView.as_view(), name="me"),
    path("users/search/", UserSearchView.as_view(), name="user-search"),
]
