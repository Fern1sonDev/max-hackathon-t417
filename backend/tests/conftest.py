import os
import sys
import tempfile
from pathlib import Path

import pytest

# Isolated SQLite database + demo data, configured before the app is imported.
_db_file = Path(tempfile.mkdtemp()) / "test.db"
os.environ.update(
    {
        "DATABASE_URL": f"sqlite:///{_db_file.as_posix()}",
        "ENV": "dev",
        "SANDBOX_LOGIN": "true",
        "ENABLE_DEMO_DATA": "true",
        "MAX_BOT_TOKEN": "",
        "MAX_WEBHOOK_SECRET": "test-secret",
        "SCHEDULER_INTERVAL_SECONDS": "3600",
    }
)
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


@pytest.fixture(scope="session")
def client():
    from fastapi.testclient import TestClient

    from app.main import app

    with TestClient(app) as test_client:
        yield test_client


def auth_header(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def login(client):
    def _login(email: str, password: str = "demo12345") -> dict:
        response = client.post("/api/login", json={"email": email, "password": password})
        assert response.status_code == 200, response.text
        return auth_header(response.json()["token"])

    return _login


@pytest.fixture
def new_student(client):
    """A fresh sandbox student that has passed onboarding."""

    def _make(user_id: str, university: str = "СКФУ (Северо-Кавказский федеральный университет)") -> dict:
        token = client.post("/api/auth", json={"user_id": user_id, "name": "Тест Тестов"}).json()["token"]
        headers = auth_header(token)
        response = client.put(
            "/api/me",
            headers=headers,
            json={"role": "student", "name": "Тест Тестов", "university": university, "group": "ИВТ-21-1", "region": "Ставропольский край", "city": "Ставрополь", "accept_terms": True, "accept_privacy": True},
        )
        assert response.status_code == 200, response.text
        return headers

    return _make
