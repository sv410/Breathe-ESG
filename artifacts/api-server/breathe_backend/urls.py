from django.contrib import admin
from django.urls import path, include
from rest_framework_simplejwt.views import TokenRefreshView
from api.views.auth import LoginView, MeView
from api.views.health import health_check, api_health

urlpatterns = [
    path("", health_check, name="root"),
    path("api/admin/", admin.site.urls),
    path("api/auth/login", LoginView.as_view(), name="token_obtain_pair"),
    path("api/auth/refresh", TokenRefreshView.as_view(), name="token_refresh"),
    path("api/auth/me", MeView.as_view(), name="me"),
    path("api/", include("api.urls")),
    path("api/healthz", api_health, name="healthz"),
]
