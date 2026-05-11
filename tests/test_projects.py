import pytest


@pytest.mark.django_db
def test_create_project(auth_client):
    response = auth_client.post("/api/projects/", {"name": "Тестовый проект", "description": "Описание"})
    assert response.status_code == 201
    assert response.data["name"] == "Тестовый проект"


@pytest.mark.django_db
def test_list_projects(auth_client):
    auth_client.post("/api/projects/", {"name": "Проект 1"})
    auth_client.post("/api/projects/", {"name": "Проект 2"})
    response = auth_client.get("/api/projects/")
    assert response.status_code == 200
    assert len(response.data) == 2


@pytest.mark.django_db
def test_unauthenticated_access(api_client):
    response = api_client.get("/api/projects/")
    assert response.status_code == 401
