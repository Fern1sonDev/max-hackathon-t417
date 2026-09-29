"""Proactive bot notifications: when a vacancy becomes visible to students
(created, or unhidden) or a curator verifies a skill, push a MAX message to
any student whose match index for a relevant open vacancy crosses
settings.match_threshold — instead of waiting for them to open the feed.

Event-triggered, not cron: the two trigger points are create_vacancy /
toggle_vacancy_active (routers/vacancies.py) and verify_skill
(routers/students.py). Always called via BackgroundTasks so it runs after the
HTTP response is sent — it must never add MAX-API latency to a request.
Each (student, vacancy) pair is pushed at most once (NotifiedMatch).
"""

import logging

from sqlalchemy.orm import Session

from app.config import settings
from app.database import SessionLocal
from app.match_score import compute_match, load_requirements, load_skill_sets
from app.max_client import is_max_user_id, max_client
from app.models import Application, NotifiedMatch, User, Vacancy

logger = logging.getLogger("notifications")


def _notify(db: Session, target_students: list[User], target_vacancies: list[Vacancy]) -> None:
    students = [s for s in target_students if is_max_user_id(s.user_id)]
    vacancies = [v for v in target_vacancies if v.is_active]
    if not students or not vacancies:
        return
    student_ids = [s.user_id for s in students]
    vacancy_ids = [v.vacancy_id for v in vacancies]
    already = {
        (row.student_id, row.vacancy_id)
        for row in db.query(NotifiedMatch.student_id, NotifiedMatch.vacancy_id).filter(NotifiedMatch.student_id.in_(student_ids))
    }
    already |= {
        (row.student_id, row.vacancy_id)
        for row in db.query(Application.student_id, Application.vacancy_id).filter(Application.student_id.in_(student_ids))
    }
    skills = load_skill_sets(db, student_ids)
    requirements = load_requirements(db, vacancy_ids)

    for student in students:
        for vacancy in vacancies:
            if (student.user_id, vacancy.vacancy_id) in already:
                continue
            result = compute_match(skills[student.user_id], requirements[vacancy.vacancy_id])
            if result.score < settings.match_threshold:
                continue
            db.add(NotifiedMatch(student_id=student.user_id, vacancy_id=vacancy.vacancy_id))
            db.commit()
            gap = f" Осталось подтвердить: {', '.join(result.missing[:3])}." if result.missing else ""
            max_client.send_message(
                student.user_id,
                f"Вам подходит стажировка «{vacancy.title}» — индекс соответствия {result.score}%.{gap}",
                buttons=[[{"text": "Открыть стажировку", "url": max_client.miniapp_link(f"vac_{vacancy.vacancy_id}")}]],
            )
            logger.info("Notified %s about vacancy %s (%.1f%%)", student.user_id, vacancy.vacancy_id, result.score)


def notify_new_matches_for_vacancy(vacancy_id: int) -> None:
    """A vacancy just became visible to students — check it against every student."""
    db = SessionLocal()
    try:
        vacancy = db.get(Vacancy, vacancy_id)
        if vacancy:
            _notify(db, db.query(User).filter(User.role == "student").all(), [vacancy])
    except Exception:
        logger.exception("notify_new_matches_for_vacancy(%s) failed", vacancy_id)
    finally:
        db.close()


def notify_new_matches_for_student(student_id: str) -> None:
    """A curator just verified a skill for this student — check every open vacancy."""
    db = SessionLocal()
    try:
        student = db.get(User, student_id)
        if student:
            _notify(db, [student], db.query(Vacancy).filter(Vacancy.is_active.is_(True)).all())
    except Exception:
        logger.exception("notify_new_matches_for_student(%s) failed", student_id)
    finally:
        db.close()
