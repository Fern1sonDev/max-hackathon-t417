"""Skill tests (university + employer), integrations registry, MAX avatar."""

from conftest import auth_header

SKFU = "СКФУ (Северо-Кавказский федеральный университет)"


def _answers_for(client, headers, test_id, curator_headers):
    # the curator (author side) sees correct answers — use them to build a passing attempt
    detail = client.get(f"/api/tests/{test_id}", headers=curator_headers).json()
    return [q["correct_index"] for q in detail["questions"]]


def test_student_passes_university_test_and_skill_gets_verified(client, login, new_student):
    student = new_student("dev-tester-1", SKFU)
    curator = login("curator@skfu.example")
    tests = client.get("/api/tests", headers=student).json()
    netbox = next(t for t in tests if t["skill"] == "NetBox")
    assert netbox["partner_name"] == "ИнтерТех Интегратор" and netbox["passed"] is False

    detail = client.get(f"/api/tests/{netbox['test_id']}", headers=student).json()
    assert all(q["correct_index"] is None for q in detail["questions"])  # answers are hidden from students

    wrong = [(a + 1) % 2 for a in _answers_for(client, student, netbox["test_id"], curator)]
    failed = client.post(f"/api/tests/{netbox['test_id']}/attempts", headers=student, json={"answers": wrong})
    assert failed.status_code == 200 and failed.json()["passed"] is False and failed.json()["attempts_left"] == 2

    right = _answers_for(client, student, netbox["test_id"], curator)
    passed = client.post(f"/api/tests/{netbox['test_id']}/attempts", headers=student, json={"answers": right})
    assert passed.json() == {"score": 100, "passed": True, "correct": [True] * len(right), "attempts_left": 1, "skill": "NetBox", "skill_verified": True}
    skills = {s["name"]: s["is_verified"] for s in client.get("/api/me/skills", headers=student).json()}
    assert skills["NetBox"] is True
    again = client.post(f"/api/tests/{netbox['test_id']}/attempts", headers=student, json={"answers": right})
    assert again.status_code == 409


def test_other_university_does_not_see_the_test(client, new_student):
    student = new_student("dev-tester-2", "КубГТУ (Кубанский государственный технологический университет)")
    titles = {t["title"] for t in client.get("/api/tests", headers=student).json()}
    assert "NetBox: документирование сети" not in titles
    assert "React: состояния интерфейса" not in titles  # still pending the curator's publication


def test_employer_proposes_and_curator_publishes(client, login):
    hr = login("hr@yugtelecomsoft.example")
    body = {
        "title": "Docker для стажёра", "skill": "docker", "university": SKFU, "pass_score": 70,
        "questions": [{"text": f"Вопрос {i}?", "options": ["да", "нет"], "correct_index": 0} for i in range(3)],
    }
    created = client.post("/api/tests", headers=hr, json=body)
    assert created.status_code == 201, created.text
    proposal = created.json()
    assert proposal["status"] == "pending" and proposal["skill"] == "Docker" and proposal["partner_name"] == "ЮгТелекомSoft"
    assert client.patch(f"/api/tests/{proposal['test_id']}/status", headers=hr, json={"status": "published"}).status_code == 403

    curator = login("curator@skfu.example")
    listed = {t["test_id"]: t for t in client.get("/api/tests", headers=curator).json()}
    assert listed[proposal["test_id"]]["can_manage"] is True
    published = client.patch(f"/api/tests/{proposal['test_id']}/status", headers=curator, json={"status": "published"})
    assert published.status_code == 200 and published.json()["status"] == "published"


def test_test_validation(client, login):
    curator = login("curator@skfu.example")
    bad = {"title": "Мало вопросов", "skill": "Linux", "questions": [{"text": "Один?", "options": ["a", "b"], "correct_index": 0}]}
    assert client.post("/api/tests", headers=curator, json=bad).status_code == 422
    bad_index = {"title": "Индекс", "skill": "Linux", "questions": [{"text": f"В{i}?", "options": ["a", "b"], "correct_index": 5} for i in range(3)]}
    assert client.post("/api/tests", headers=curator, json=bad_index).status_code == 422


def test_integrations_registry_and_secrets_not_stored(client, login):
    hr = login("hr@intertech.example")
    items = {i["id"]: i for i in client.get("/api/integrations", headers=hr).json()}
    assert {"huntflow", "potok", "hh", "superjob", "trudvsem"} <= set(items) and "moodle" not in items
    missing = client.put("/api/integrations/huntflow", headers=hr, json={"settings": {"account_id": "42"}})
    assert missing.status_code == 422
    ok = client.put("/api/integrations/huntflow", headers=hr, json={"settings": {"account_id": "42", "token": "secret-token-abcd"}})
    assert ok.status_code == 200
    assert ok.json()["settings"] == {"account_id": "42", "token": "••••abcd"} and ok.json()["connected"] is True
    assert client.delete("/api/integrations/huntflow", headers=hr).status_code == 204

    curator = login("curator@skfu.example")
    curator_ids = {i["id"] for i in client.get("/api/integrations", headers=curator).json()}
    assert {"moodle", "1c-university", "trudvsem"} <= curator_ids and "huntflow" not in curator_ids
    student = client.post("/api/auth", json={"user_id": "demo-student-1"}).json()["token"]
    assert client.get("/api/integrations", headers=auth_header(student)).status_code == 403


def test_avatar_from_max_bot_update_is_stored(client):
    token = client.post("/api/auth", json={"user_id": "dev-avatar"}).json()["token"]
    headers = {"X-Max-Bot-Api-Secret": "test-secret"}
    update = {"update_type": "message_created", "message": {"sender": {"user_id": "dev-avatar", "avatar_url": "https://i.oneme.ru/i?r=abc"}, "body": {"text": "/help"}}}
    assert client.post("/webhook", headers=headers, json=update).status_code == 200
    assert client.get("/api/me", headers=auth_header(token)).json()["avatar_url"] == "https://i.oneme.ru/i?r=abc"
    unsafe = {"update_type": "message_created", "message": {"sender": {"user_id": "dev-avatar", "avatar_url": "javascript:alert(1)"}, "body": {"text": "/help"}}}
    client.post("/webhook", headers=headers, json=unsafe)
    assert client.get("/api/me", headers=auth_header(token)).json()["avatar_url"] == "https://i.oneme.ru/i?r=abc"
