from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from .views import login_view, projects_view, board_view

urlpatterns = [
    # HTML страницы
    path("", projects_view, name="projects"),
    path("login", login_view, name="login"),
    path("board", board_view, name="board"),
    # Admin
    path("admin/", admin.site.urls),
    # API docs
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
    # API
    path("api/auth/token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/auth/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("api/", include("apps.users.urls")),
    path("api/", include("apps.projects.urls")),
    path("api/", include("apps.tasks.urls")),
] + static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
