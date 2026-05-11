import pytest
from apps.projects.models import Project


@pytest.fixture
def project(user):
    return Project.objects.create(name="Тест проект", owner=user)


@pytest.mark.django_db
def test_create_task(auth_client, project):
    response = auth_client.post("/api/tasks/", {
        "title": "Первая задача",
        "project": project.id,
        "priority": "high",
    })
    assert response.status_code == 201
    assert response.data["title"] == "Первая задача"
    assert response.data["status"] == "todo"


@pytest.mark.django_db
def test_update_task_status(auth_client, project):
    create = auth_client.post("/api/tasks/", {"title": "Задача", "project": project.id})
    task_id = create.data["id"]
    response = auth_client.patch(f"/api/tasks/{task_id}/", {"status": "in_progress"})
    assert response.status_code == 200
    assert response.data["status"] == "in_progress"


@pytest.mark.django_db
def test_filter_tasks_by_status(auth_client, project):
    auth_client.post("/api/tasks/", {"title": "T1", "project": project.id})
    auth_client.post("/api/tasks/", {"title": "T2", "project": project.id, "status": "done"})
    response = auth_client.get("/api/tasks/?status=todo")
    assert response.status_code == 200
    assert all(t["status"] == "todo" for t in response.data)
