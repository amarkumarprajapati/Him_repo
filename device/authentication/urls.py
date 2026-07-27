from django.urls import path

from . import views

app_name = "authentication"

urlpatterns = [
    path("login/", views.LoginView.as_view(), name="login"),
    path("logout/", views.logout_view, name="logout"),
    path("users/", views.UserListView.as_view(), name="user-list"),
    path("users/<int:user_id>/", views.get_user_detail, name="user-detail"),
    path("roles/", views.list_roles, name="role-list"),
]
