"""End-to-end API checks of the main scenario on a throwaway SQLite database
with demo data (see conftest.py)."""

from datetime import datetime, timedelta

from conftest import auth_header


def _expire_decision_window(app_id: int) -> None:
    from app.database import SessionLocal
    from app.models import Application, OutboxMessage

    db = SessionLocal()
    past = datetime.utcnow() - timedelta(seconds=1)
    db.query(Application).filter(Application.app_id == app_id).update({"decision_visible_at": past})
    db.query(OutboxMessage).filter(OutboxMessage.app_id == app_id).update({"send_after": past})
    db.commit()
    db.close()


def test_health(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"ok": True, "database": True, "max_bot": "mock"}


def test_sandbox_login_rejects_real_max_ids(client):
    assert client.post("/api/auth", json={"user_id": "123456789", "name": "x"}).status_code == 401
    assert client.post("/api/auth", json={"user_id": "dev-abc", "name": "x"}).status_code == 200
    assert client.post("/api/auth", json={"init_data": "user=%7B%7D&hash=bad"}).status_code == 401


def test_consent_is_required_before_using_the_api(client):
    token = client.post("/api/auth", json={"user_id": "dev-noconsent"}).json()["token"]
    assert client.get("/api/vacancies", headers=auth_header(token)).status_code == 428
    assert client.get("/api/me", headers=auth_header(token)).status_code == 200


def test_demo_match_index_counts_all_skills_and_verified_share(client, login):
    hr = login("hr@intertech.example")
    apps = client.get("/api/applications", headers=hr).json()
    net = {a["student_id"]: a for a in apps if a["vacancy_title"] == "Стажёр по сетевой инфраструктуре"}
    assert net["demo-student-1"]["match_score"] == 100.0
    assert net["demo-student-2"]["match_score"] == 80.0  # 3 verified + 2 claimed
    assert net["demo-student-2"]["match"]["verified_score"] == 60.0
    assert net["demo-student-1"]["student_phone"].startswith("+7")  # the employer can call the candidate
    student3 = client.post("/api/auth", json={"user_id": "demo-student-3"}).json()["token"]
    feed = client.get("/api/vacancies", headers=auth_header(student3)).json()
    network = next(v for v in feed if v["title"] == "Стажёр по сетевой инфраструктуре")
    assert network["match_score"] == 30.0 and network["match"]["verified_score"] == 20.0


def test_full_scenario_claim_review_apply_answer_decide_with_undo(client, login, new_student):
    student = new_student("dev-scenario")
    for skill in ["linux", "Zabbix", "Proxmox"]:
        assert client.post("/api/me/skills", headers=student, json={"skill_name": skill}).status_code == 200
    feed = client.get("/api/vacancies", headers=student).json()
    admin = next(v for v in feed if v["title"] == "Стажер-администратор")
    assert admin["match_score"] == 50.0 and admin["match"]["potential"] == 100.0 and admin["test_questions_count"] == 2

    # the curator reviews the profile in one batch -> one summary notification
    curator = login("curator@skfu.example")
    me = next(s for s in client.get("/api/students", headers=curator).json() if s["user_id"] == "dev-scenario")
    decisions = [{"skill_id": s["skill_id"], "status": "verified", "comment": "Лабораторные" if s["name"] == "Linux" else ""} for s in me["skills"]]
    review = client.put("/api/students/dev-scenario/skills", headers=curator, json={"decisions": decisions})
    assert review.status_code == 200 and review.json()["changed"] == 3 and review.json()["notified"] is True
    from app.database import SessionLocal
    from app.models import OutboxMessage

    db = SessionLocal()
    assert db.query(OutboxMessage).filter(OutboxMessage.user_id == "dev-scenario", OutboxMessage.kind == "review").count() == 1
    db.close()
    assert client.get(f"/api/vacancies/{admin['vacancy_id']}", headers=student).json()["match_score"] == 100.0

    # apply (idempotent) and answer both questions
    first = client.post("/api/applications", headers=student, json={"vacancy_id": admin["vacancy_id"]})
    second = client.post("/api/applications", headers=student, json={"vacancy_id": admin["vacancy_id"]})
    assert first.json()["app_id"] == second.json()["app_id"]
    app_id = first.json()["app_id"]
    assert client.post(f"/api/applications/{app_id}/answer", headers=student, json={"answers": ["только один"]}).status_code == 422
    answered = client.post(f"/api/applications/{app_id}/answer", headers=student, json={"answers": ["CPU, RAM, диск, сеть", "Триггер с гистерезисом"]})
    assert answered.status_code == 200 and len(answered.json()["test_answers"]) == 2

    # the employer sees it in the vacancy pipeline and invites with next steps
    hr = login("hr@intertech.example")
    pipeline = client.get(f"/api/vacancies/{admin['vacancy_id']}/applications", headers=hr).json()
    assert any(a["app_id"] == app_id for a in pipeline)
    step = {"format": "office", "datetime": "пятница 14:00", "place": "ул. Примерная, 1", "contact_name": "Елена", "contact_phone": "+7 900 200-00-01"}
    decided = client.patch(f"/api/applications/{app_id}", headers=hr, json={"status": "accepted", "next_step": step})
    assert decided.status_code == 200 and decided.json()["pending_decision_until"] is not None
    # inside the undo window the student still sees "pending"
    mine = next(a for a in client.get("/api/applications", headers=student).json() if a["app_id"] == app_id)
    assert mine["status"] == "pending" and mine["next_step"] is None
    undone = client.post(f"/api/applications/{app_id}/undo", headers=hr)
    assert undone.status_code == 200 and undone.json()["status"] == "pending"

    client.patch(f"/api/applications/{app_id}", headers=hr, json={"status": "accepted", "next_step": step})
    _expire_decision_window(app_id)
    from app.scheduled_jobs import deliver_outbox

    assert deliver_outbox() >= 1
    mine = next(a for a in client.get("/api/applications", headers=student).json() if a["app_id"] == app_id)
    assert mine["status"] == "accepted" and mine["next_step"]["place"] == "ул. Примерная, 1"
    assert [e["kind"] for e in mine["events"]] == ["created", "answered", "accepted"]
    assert client.post(f"/api/applications/{app_id}/undo", headers=hr).status_code == 409
    assert client.post(f"/api/applications/{app_id}/answer", headers=student, json={"answers": ["a", "b"]}).status_code == 409
    assert client.patch(f"/api/applications/{app_id}", headers=hr, json={"status": "missed"}).status_code == 422


def test_profile_reset_clears_skills_and_applications(client, new_student):
    student = new_student("dev-reset")
    client.post("/api/me/skills", headers=student, json={"skill_name": "Docker"})
    vacancy_id = client.get("/api/vacancies", headers=student).json()[0]["vacancy_id"]
    client.post("/api/applications", headers=student, json={"vacancy_id": vacancy_id})
    body = client.post("/api/me/reset", headers=student).json()
    assert body["removed_skills"] == 1 and body["removed_applications"] == 1
    assert body["profile"]["role"] == "" and body["profile"]["consent_complete"] is False
    again = client.put("/api/me", headers=student, json={"role": "student", "name": "Снова", "accept_terms": True, "accept_privacy": True})
    assert again.status_code == 200
    assert client.get("/api/me/skills", headers=student).json() == []


def test_shared_demo_profile_cannot_be_reset(client):
    token = client.post("/api/auth", json={"user_id": "demo-student-1"}).json()["token"]
    assert client.post("/api/me/reset", headers=auth_header(token)).status_code == 403


def test_role_boundaries(client, login, new_student):
    student = new_student("dev-roles")
    assert client.post("/api/vacancies", headers=student, json={"title": "Хак", "required_skills": ["Linux"]}).status_code == 403
    assert client.get("/api/students", headers=student).status_code == 403
    assert client.put("/api/me", headers=student, json={"role": "hr", "name": "x"}).status_code == 403
    hr2 = login("hr@yugtelecomsoft.example")
    foreign = client.get("/api/applications", headers=login("hr@intertech.example")).json()[0]["app_id"]
    assert client.patch(f"/api/applications/{foreign}", headers=hr2, json={"status": "accepted"}).status_code == 403
    assert client.patch("/api/me/password", headers=hr2, json={"current_password": "demo12345", "new_password": "newpassword1"}).status_code == 403


def test_vacancy_validation_questions_and_geo(client, login):
    hr = login("hr@intertech.example")
    assert client.post("/api/vacancies", headers=hr, json={"title": "Без навыков"}).status_code == 422
    typo = {"title": "Стажёр QA", "required_skills": ["Python"], "region": "Ставропольский кр", "city": "Ставрополь"}
    assert client.post("/api/vacancies", headers=hr, json=typo).status_code == 422
    created = client.post("/api/vacancies", headers=hr, json={
        "title": "Стажёр QA", "required_skills": ["Python", "python"], "optional_skills": ["Git", "Python"],
        "test_questions": ["Что такое тест-кейс?", "Как воспроизвести плавающий баг?"], "region": "ставропольский край", "city": "пятигорск",
    })
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["core_skills"] == ["Python"] and body["optional_skills"] == ["Git"]
    assert body["region"] == "Ставропольский край" and body["city"] == "Пятигорск" and body["test_questions_count"] == 2
    assert client.get("/api/geo").json()["regions"][0]["cities"]


def test_groups_invite_locks_student_fields(client, login):
    curator = login("curator@skfu.example")
    group = client.post("/api/groups", headers=curator, json={"name": "ИБ-23-1", "course": 1, "region": "Ставропольский край", "city": "Ставрополь"})
    assert group.status_code == 201, group.text
    code = group.json()["invite_code"]
    assert group.json()["invite_url"].endswith(f"startapp=g_{code}")
    public = client.get(f"/api/public/groups/{code}").json()
    assert public["group"] == "ИБ-23-1" and public["university"].startswith("СКФУ")
    assert client.get("/api/public/groups/nope").status_code == 404

    token = client.post("/api/auth", json={"user_id": "dev-grouped"}).json()["token"]
    joined = client.put("/api/me", headers=auth_header(token), json={
        "role": "student", "name": "Гость", "university": "Другой вуз", "group": "X", "region": "Москва", "city": "Москва",
        "group_code": code, "accept_terms": True, "accept_privacy": True,
    }).json()
    assert joined["group"] == "ИБ-23-1" and joined["group_locked"] is True and joined["university"].startswith("СКФУ")
    students = client.get(f"/api/groups/{group.json()['group_id']}/students", headers=curator).json()
    assert [s["user_id"] for s in students] == ["dev-grouped"]


def test_team_invites_share_the_workspace(client, login):
    owner = login("hr@intertech.example")
    invite = client.post("/api/team/invites", headers=owner, json={"name": "Новый Рекрутер", "email": "new.recruiter@intertech.example"})
    assert invite.status_code == 201
    token = invite.json()["token"]
    assert client.get(f"/api/invites/{token}").json()["org_name"] == "ИнтерТех Интегратор"
    accepted = client.post(f"/api/invites/{token}/accept", json={"name": "Новый Рекрутер", "password": "recruiter123", "accept_terms": True, "accept_privacy": True})
    assert accepted.status_code == 200
    member = auth_header(accepted.json()["token"])
    titles = {v["title"] for v in client.get("/api/vacancies/mine", headers=member).json()}
    assert "Стажёр по сетевой инфраструктуре" in titles
    assert client.post("/api/team/invites", headers=member, json={"name": "Ещё", "email": "x@intertech.example"}).status_code == 403
    assert client.post(f"/api/invites/{token}/accept", json={"name": "Повторно", "password": "recruiter123", "accept_terms": True, "accept_privacy": True}).status_code == 404
    team = client.get("/api/team", headers=owner).json()
    assert any(m["email"] == "new.recruiter@intertech.example" for m in team["members"])


def test_review_statuses_and_rejected_skill_does_not_count(client, login, new_student):
    student = new_student("dev-review")
    client.post("/api/me/skills", headers=student, json={"skill_name": "Python"})
    curator = login("curator@skfu.example")
    me = next(s for s in client.get("/api/students", headers=curator).json() if s["user_id"] == "dev-review")
    skill_id = me["skills"][0]["skill_id"]
    r = client.put("/api/students/dev-review/skills", headers=curator, json={"decisions": [{"skill_id": skill_id, "status": "employer_review", "comment": "Пишет бота на Python"}]})
    assert r.json()["student"]["skills"][0]["status"] == "employer_review"
    feed = {v["title"]: v for v in client.get("/api/vacancies", headers=student).json()}
    assert next(i for i in feed["Стажёр по автоматизации сетей"]["match"]["items"] if i["skill"] == "Python")["status"] == "employer"
    client.put("/api/students/dev-review/skills", headers=curator, json={"decisions": [{"skill_id": skill_id, "status": "rejected", "comment": "Нет подтверждений"}]})
    feed = {v["title"]: v for v in client.get("/api/vacancies", headers=student).json()}
    assert feed["Стажёр по автоматизации сетей"]["match_score"] == 0.0


def test_public_portfolio(client):
    token = client.post("/api/auth", json={"user_id": "demo-student-1"}).json()["token"]
    profile = client.patch("/api/me/portfolio", headers=auth_header(token), json={"public": True}).json()
    slug = profile["portfolio_url"].rsplit("/", 1)[-1]
    portfolio = client.get(f"/api/public/portfolio/{slug}")
    assert portfolio.status_code == 200 and portfolio.json()["name"] == "Иван Петров"
    assert "Linux" in portfolio.json()["certificate_urls"] and portfolio.json()["contact"] == ""
    client.patch("/api/me/portfolio", headers=auth_header(token), json={"public": False})
    assert client.get(f"/api/public/portfolio/{slug}").status_code == 404


def test_webhook_secret_and_bot_talks_only_to_known_users(client, new_student):
    from app.database import SessionLocal
    from app.models import BotContact

    assert client.post("/webhook", json={"update_type": "bot_started"}).status_code == 401
    headers = {"X-Max-Bot-Api-Secret": "test-secret"}
    stranger = {"update_type": "message_created", "message": {"sender": {"user_id": 777}, "body": {"text": "привет"}}}
    assert client.post("/webhook", headers=headers, json=stranger).status_code == 200
    db = SessionLocal()
    assert db.get(BotContact, "777") is not None  # got the start message once, rate limited afterwards
    db.close()
    new_student("dev-bot-user")
    known = {"update_type": "message_created", "message": {"sender": {"user_id": "dev-bot-user"}, "body": {"text": "/status"}}}
    assert client.post("/webhook", headers=headers, json=known).status_code == 200
    callback = {"update_type": "message_callback", "callback": {"callback_id": "cb1", "payload": "help", "user": {"user_id": "dev-bot-user"}}}
    assert client.post("/webhook", headers=headers, json=callback).status_code == 200
    assert client.post("/webhook", headers=headers, content=b"not json").status_code == 200


def test_login_rate_limit(client):
    for _ in range(10):
        client.post("/api/login", json={"email": "nobody@example.com", "password": "wrong"})
    assert client.post("/api/login", json={"email": "nobody@example.com", "password": "wrong"}).status_code == 429


def test_analytics_and_public_certificate(client, login):
    curator = login("curator@skfu.example")
    for path in ("/api/analytics/regions", "/api/analytics/skills-gap", "/api/analytics/unmet-demand", "/api/analytics/funnel", "/api/leaderboard", "/api/analytics/university", "/api/groups"):
        assert client.get(path, headers=curator).status_code == 200, path
    uni = client.get("/api/analytics/university", headers=curator).json()
    assert uni["employers"] and uni["skills_demand"] and uni["by_group"]
    roster = client.get("/api/students", headers=curator).json()
    ivan = next(s for s in roster if s["user_id"] == "demo-student-1")
    skill = next(s for s in ivan["skills"] if s["is_verified"])
    url = client.get(f"/api/students/demo-student-1/skills/{skill['skill_id']}/certificate-link", headers=curator).json()["url"]
    cert = client.get(f"/api/certificates/demo-student-1/{skill['skill_id']}/{url.rstrip('/').split('/')[-1]}")
    assert cert.status_code == 200 and cert.json()["student_name"] == "Иван Петров"
    assert client.get(f"/api/certificates/demo-student-1/{skill['skill_id']}/forged").status_code == 404
