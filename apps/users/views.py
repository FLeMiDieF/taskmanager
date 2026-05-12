from rest_framework import generics, permissions
from rest_framework.views import APIView
from rest_framework.response import Response
from django.db.models import Q
from django.contrib.auth import get_user_model
from .serializers import RegisterSerializer, UserSerializer

User = get_user_model()


class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = RegisterSerializer
    permission_classes = (permissions.AllowAny,)


class MeView(generics.RetrieveUpdateAPIView):
    serializer_class = UserSerializer

    def get_object(self):
        return self.request.user


class UserSearchView(APIView):
    """Поиск пользователей по email или username (минимум 2 символа)."""
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        q = request.query_params.get("q", "").strip()
        if len(q) < 2:
            return Response([])
        users = User.objects.filter(
            Q(email__icontains=q) | Q(username__icontains=q)
        ).exclude(id=request.user.id)[:10]
        return Response(UserSerializer(users, many=True).data)
