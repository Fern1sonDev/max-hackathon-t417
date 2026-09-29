"""Time-based background jobs — unlike notifications.py (event-triggered via
FastAPI BackgroundTasks), these fire on their own schedule:

1. SLA anti-ignore: a pending application older than settings.sla_total_hours
   auto-escalates to status "missed" and the student is notified with
   alternative vacancy suggestions. (The "overdue at 48h" warning HR sees is
   a live-computed field, see services.is_overdue.) Demo students
   (`demo-*`) are excluded so the jury's demo board stays stable during the
   check period; the escalation itself is shown by a seeded "missed" card.
2. Passive-student nudge: a student who registered but never applied within
   settings.passive_days gets one soft nudge message (deduped via PassiveNudge).

Run from a single asyncio task started in main.py's lifespan.
"""

import json
import logging
from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from app.config import settings
from app.database import SessionLocal
from app.match_score import compute_match, load_requirements, load_skill_sets
from app.max_client import is_max_user_id, max_client
from app.models import Application, OutboxMessage, PassiveNudge, User, Vacancy
from app.services import log_event

logger = logging.getLogger("scheduled_jobs")

_ALTERNATIVES_LIMIT = 2


def _suggest_alternatives(db: Session, student_id: str, exclude_vacancy_id: int) -> list[tuple[Vacancy, float]]:
    applied = {row.vacancy_id for row in db.query(Application.vacancy_id).filter(Application.student_id == student_id)}
    vacancies = [v for v in db.query(Vacancy).filter(Vacancy.is_active.is_(True)) if v.vacancy_id != exclude_vacancy_id and v.vacancy_id not in applied]
    skills = load_skill_sets(db, [student_id])[student_id]
    requirements = load_requirements(db, [v.vacancy_id for v in vacancies])
    scored = [(v, compute_match(skills, requirements[v.vacancy_id]).score) for v in vacancies]
    scored = [(v, s) for v, s in scored if s >= settings.match_threshold]
    scored.sort(key=lambda pair: pair[1], reverse=True)
    return scored[:_ALTERNATIVES_LIMIT]


def run_sla_escalation(db: Session) -> None:
    now = datetime.utcnow()
    stale = (
        db.query(Application)
        .filter(Application.status == "pending", ~Application.student_id.like("demo-%"))
        .all()
    )
    for app in stale:
        hours_pending = (now - app.updated_at).total_seconds() / 3600
        if hours_pending < settings.sla_total_hours:
            continue
        app.status = "missed"
        log_event(db, app, "missed", f"Работодатель не ответил за {int(settings.sla_total_hours)} ч — отклик снят автоматически")
        db.commit()

        alternatives = _suggest_alternatives(db, app.student_id, app.vacancy_id)
        head = f"По стажировке «{app.vacancy.title}» работодатель не ответил за {int(settings.sla_total_hours)} ч, заявка снята с рассмотрения."
        if alternatives:
            lines = "\n".join(f"• {v.title} — {score}%" for v, score in alternatives)
            text = f"{head}\n\nПохожие стажировки, где вы подходите:\n{lines}"
        else:
            text = f"{head}\n\nПока нет других подходящих стажировок — мы напишем, когда они появятся."
        max_client.send_message(app.student_id, text, buttons=[[{"text": "Открыть ПрактикаПлюс", "url": max_client.miniapp_link()}]])
        logger.info("Escalated application %s to missed (%.1fh pending)", app.app_id, hours_pending)


def run_passive_nudge(db: Session) -> None:
    cutoff = datetime.utcnow() - timedelta(days=settings.passive_days)
    with_applications = {row.student_id for row in db.query(Application.student_id).distinct()}
    already_nudged = {row.student_id for row in db.query(PassiveNudge.student_id)}
    for student in db.query(User).filter(User.role == "student", User.created_at <= cutoff).all():
        if student.user_id in with_applications or student.user_id in already_nudged or not is_max_user_id(student.user_id):
            continue
        max_client.send_message(
            student.user_id,
            "Давно не виделись! В ПрактикаПлюс могли появиться стажировки по вашим навыкам. "
            "Нужна помощь с выбором направления? Напишите /help или загляните в ленту.",
            buttons=[[{"text": "Открыть ПрактикаПлюс", "url": max_client.miniapp_link()}]],
        )
        db.add(PassiveNudge(student_id=student.user_id))
        db.commit()
        logger.info("Nudged passive student %s", student.user_id)


def deliver_outbox() -> int:
    """Sends due, non-cancelled delayed messages (employer decisions after
    their undo window, batched skill-review summaries). Called every
    OUTBOX_INTERVAL_SECONDS from main.py."""
    db = SessionLocal()
    sent = 0
    try:
        now = datetime.utcnow()
        due = (
            db.query(OutboxMessage)
            .filter(OutboxMessage.sent_at.is_(None), OutboxMessage.cancelled_at.is_(None), OutboxMessage.send_after <= now)
            .order_by(OutboxMessage.id)
            .limit(50)
            .all()
        )
        for msg in due:
            msg.sent_at = now  # mark first: a crash mid-send must not produce a duplicate
            db.commit()
            try:
                buttons = json.loads(msg.buttons or "[]") or None
            except ValueError:
                buttons = None
            max_client.send_message(msg.user_id, msg.text, buttons=buttons)
            sent += 1
    except Exception:
        logger.exception("Outbox delivery failed")
    finally:
        db.close()
    return sent


def run_scheduled_pass() -> None:
    """One pass of both jobs — called via asyncio.to_thread from main.py so
    the blocking DB/HTTP calls never stall the event loop."""
    db = SessionLocal()
    try:
        run_sla_escalation(db)
        run_passive_nudge(db)
    except Exception:
        logger.exception("Scheduled jobs pass failed")
    finally:
        db.close()
