"""MAX bot: the chat half of the product.

Who the bot talks to:
  * registered students (a profile created through the mini app with a
    MAX-signed launch) — full functionality;
  * people who came with a valid group invite (`start` payload g_<code>) —
    a welcome that opens the mini app pre-filled for their group;
  * anyone else gets only the start message with the mini app button, at
    most once per UNKNOWN_USER_REPLY_MINUTES; other messages are ignored.

Commands for students: /start, /status, /help, /reset (confirmed by inline
buttons); a plain text message is an answer to a pending test task.
"""

import hmac
import json
import logging
import re
from datetime import datetime, timedelta

from fastapi import APIRouter, HTTPException, Request
from sqlalchemy.orm import joinedload

from app.config import settings
from app.database import SessionLocal
from app.max_client import max_client
from app.models import Application, BotContact, StudentGroup, User, Vacancy
from app.services import STATUS_LABEL, applications_out, log_event, questions_of, reset_student_profile, safe_avatar_url, visible_status

logger = logging.getLogger("webhook")
router = APIRouter(tags=["max-bot"])

WELCOME_TEXT = (
    "Привет! Это ПрактикаПлюс — стажировки, где навыки подтверждает вуз.\n\n"
    "1. Откройте мини-приложение и отметьте свои навыки.\n"
    "2. Смотрите стажировки с индексом соответствия.\n"
    "3. Откликайтесь в один тап — задание и решение компании придут сюда, в чат.\n\n"
    "Команды: /status — мои отклики, /help — помощь, /reset — начать заново."
)
GUEST_TEXT = (
    "ПрактикаПлюс — стажировки по навыкам, подтверждённым вузом.\n"
    "Откройте мини-приложение, чтобы создать профиль. Если вуз прислал ссылку-приглашение группы — откройте её: вуз и группа заполнятся сами."
)
HELP_TEXT = (
    "Что умеет бот ПрактикаПлюс:\n"
    "• присылает тестовое задание сразу после отклика — ответьте обычным сообщением;\n"
    "• сообщает о решении работодателя и следующих шагах;\n"
    "• присылает новые стажировки, где вы подходите;\n"
    "• /status — статусы откликов, /reset — полностью сбросить профиль.\n\n"
    "Индекс соответствия учитывает все ваши навыки: подтверждённые вузом — полностью, заявленные — наполовину."
)
MAIN_BUTTONS = [
    [{"text": "Открыть ПрактикаПлюс", "url": max_client.miniapp_link()}],
    [{"text": "Мои отклики", "payload": "status"}, {"text": "Помощь", "payload": "help"}],
]


def _sender(update: dict) -> dict:
    return update.get("user") or (update.get("callback") or {}).get("user") or (update.get("message") or {}).get("sender") or {}


def _extract_user_id(update: dict) -> str | None:
    user_id = _sender(update).get("user_id")
    return str(user_id) if user_id is not None else None


def _extract_text(update: dict) -> str:
    return (((update.get("message") or {}).get("body") or {}).get("text") or "").strip()


def _registered(user_id: str) -> bool:
    db = SessionLocal()
    try:
        user = db.get(User, user_id)
        return bool(user and user.role == "student")
    finally:
        db.close()


def _remember_avatar(update: dict, user_id: str | None) -> None:
    """Bot updates carry the sender's MAX avatar — keep the profile photo fresh."""
    sender = _sender(update)
    avatar = safe_avatar_url(sender.get("avatar_url") or sender.get("full_avatar_url"))
    if not user_id or not avatar:
        return
    db = SessionLocal()
    try:
        row = db.get(User, user_id)
        if row and row.avatar_url != avatar:
            row.avatar_url = avatar
            db.commit()
    finally:
        db.close()


def _group_for(payload: str) -> StudentGroup | None:
    if not payload.startswith("g_"):
        return None
    db = SessionLocal()
    try:
        return db.query(StudentGroup).filter(StudentGroup.invite_code == payload[2:]).first()
    finally:
        db.close()


def _guest_reply(user_id: str) -> None:
    """Start message for an unknown user, rate limited."""
    db = SessionLocal()
    try:
        contact = db.get(BotContact, user_id)
        now = datetime.utcnow()
        if contact and contact.last_reply_at and now - contact.last_reply_at < timedelta(minutes=settings.unknown_user_reply_minutes):
            return
        if not contact:
            contact = BotContact(user_id=user_id)
            db.add(contact)
        contact.last_reply_at = now
        db.commit()
    finally:
        db.close()
    max_client.send_message(user_id, GUEST_TEXT, buttons=[[{"text": "Открыть ПрактикаПлюс", "url": max_client.miniapp_link()}]])


def _welcome(user_id: str, payload: str = "") -> None:
    group = _group_for(payload) if payload else None
    if group:
        max_client.send_message(
            user_id,
            f"Приглашение от вуза: {group.university}, группа {group.name}.\nОткройте мини-приложение — вуз, группа и город заполнятся автоматически.",
            buttons=[[{"text": f"Присоединиться к группе {group.name}", "url": max_client.miniapp_link(f"g_{group.invite_code}")}]],
        )
    elif _registered(user_id):
        max_client.send_message(user_id, WELCOME_TEXT, buttons=MAIN_BUTTONS)
    else:
        _guest_reply(user_id)


def _status_text(user_id: str) -> str:
    db = SessionLocal()
    try:
        apps = (
            db.query(Application)
            .options(joinedload(Application.vacancy).joinedload(Vacancy.company), joinedload(Application.student), joinedload(Application.events))
            .filter(Application.student_id == user_id)
            .order_by(Application.updated_at.desc())
            .limit(10)
            .all()
        )
        if not apps:
            return "Откликов пока нет. Откройте мини-приложение — там стажировки, отсортированные по индексу соответствия."
        lines = ["Ваши отклики:"]
        for app in applications_out(db, apps):
            waiting = app.status == "pending" and app.test_questions and not (app.test_answer or app.test_answers)
            extra = " · ждём ответ на задание" if waiting else (" · ответ отправлен" if app.status == "pending" and app.test_answer else "")
            lines.append(f"• #{app.app_id} «{app.vacancy_title}» — {STATUS_LABEL.get(app.status, app.status)}, индекс {app.match_score}%{extra}")
        return "\n".join(lines)
    finally:
        db.close()


def _reset(user_id: str) -> str:
    db = SessionLocal()
    try:
        user = db.get(User, user_id)
        if not user or user.role not in ("student", ""):
            return "Сбрасывать нечего: профиль студента ещё не создан."
        skills, apps = reset_student_profile(db, user)
        db.commit()
        return f"Профиль сброшен: удалено навыков — {skills}, откликов — {apps}. Откройте мини-приложение, чтобы пройти регистрацию заново."
    finally:
        db.close()


def _handle_answer(user_id: str, text: str) -> None:
    db = SessionLocal()
    try:
        candidates = [
            a for a in db.query(Application).options(joinedload(Application.vacancy)).join(Application.vacancy)
            .filter(Application.student_id == user_id, Application.status == "pending", Application.test_answer == "")
            .order_by(Application.created_at.desc()).all()
            if questions_of(a.vacancy) and visible_status(a) == "pending"
        ]
        code = re.match(r"^#(\d+)(?:\s+|$)", text)
        if code:
            application = next((row for row in candidates if row.app_id == int(code.group(1))), None)
            answer = text[code.end():].strip()
        elif len(candidates) == 1:
            application, answer = candidates[0], text
        else:
            application, answer = None, ""

        if application and answer:
            application.test_answer = answer[:10000]
            questions = questions_of(application.vacancy)
            application.test_answers = json.dumps([application.test_answer], ensure_ascii=False) if len(questions) == 1 else ""
            log_event(db, application, "answered", "Ответ на задание отправлен из чата MAX")
            db.commit()
            max_client.send_message(user_id, f"Ответ на задание «{application.vacancy.title}» передан компании. Решение придёт сюда же. Статус — /status.")
        elif candidates:
            numbers = ", ".join(f"#{row.app_id} «{row.vacancy.title}»" for row in candidates[:5])
            max_client.send_message(
                user_id,
                f"У вас несколько заданий без ответа: {numbers}. Начните сообщение с номера, например: #{candidates[0].app_id} ваш ответ.",
                buttons=[[{"text": "Ответить в мини-приложении", "url": max_client.miniapp_link("apps")}]],
            )
        else:
            max_client.send_message(user_id, "Сейчас нет заданий, ожидающих ответа. Команды: /status — мои отклики, /help — помощь.", buttons=MAIN_BUTTONS)
    finally:
        db.close()


def _handle_command(user_id: str, command: str, argument: str = "") -> None:
    if command in ("/start", "start"):
        _welcome(user_id, argument)
    elif command in ("/status", "status"):
        max_client.send_message(user_id, _status_text(user_id), buttons=[[{"text": "Открыть отклики", "url": max_client.miniapp_link("apps")}]])
    elif command in ("/help", "help"):
        max_client.send_message(user_id, HELP_TEXT, buttons=MAIN_BUTTONS)
    elif command in ("/reset", "reset"):
        max_client.send_message(
            user_id,
            "Сбросить профиль студента? Удалятся навыки (в том числе подтверждённые), отклики, ответы и статусы. Отменить это нельзя.",
            buttons=[[{"text": "Да, сбросить", "payload": "reset:confirm"}, {"text": "Отмена", "payload": "reset:cancel"}]],
        )
    else:
        max_client.send_message(user_id, "Не знаю такой команды. Доступно: /status, /help, /reset.", buttons=MAIN_BUTTONS)


def _handle_callback(update: dict, user_id: str) -> None:
    callback = update.get("callback") or {}
    callback_id = callback.get("callback_id")
    payload = (callback.get("payload") or "").strip()
    if not callback_id:
        return
    if payload == "reset:confirm":
        max_client.answer_callback(callback_id, _reset(user_id), buttons=[[{"text": "Открыть ПрактикаПлюс", "url": max_client.miniapp_link()}]])
    elif payload == "reset:cancel":
        max_client.answer_callback(callback_id, "Сброс отменён — профиль на месте.")
    elif payload == "status":
        max_client.answer_callback(callback_id, _status_text(user_id), buttons=[[{"text": "Открыть отклики", "url": max_client.miniapp_link("apps")}]])
    elif payload == "help":
        max_client.answer_callback(callback_id, HELP_TEXT, buttons=MAIN_BUTTONS)
    else:
        max_client.answer_callback(callback_id, WELCOME_TEXT, buttons=MAIN_BUTTONS)


@router.post("/webhook", summary="Приём событий бота MAX (POST /subscriptions)")
async def receive_update(request: Request):
    """Always 200 for an authenticated call, even on a malformed body — MAX
    retries non-200 responses and unsubscribes after 8 hours of failures."""
    # With MAX_WEBHOOK_SECRET set, MAX sends it in X-Max-Bot-Api-Secret and anything else is rejected.
    if settings.max_webhook_secret:
        supplied_secret = request.headers.get("X-Max-Bot-Api-Secret", "")
        if not hmac.compare_digest(supplied_secret, settings.max_webhook_secret):
            raise HTTPException(status_code=401, detail="Invalid webhook secret")
    try:
        update = await request.json()
    except ValueError:
        logger.warning("MAX webhook: non-JSON body, ignoring")
        return {"ok": True}
    if not isinstance(update, dict):
        return {"ok": True}

    update_type = update.get("update_type")
    logger.info("MAX update: %s", update_type)
    try:
        user_id = _extract_user_id(update)
        if not user_id:
            return {"ok": True}
        _remember_avatar(update, user_id)
        if update_type == "bot_started":
            _welcome(user_id, str(update.get("payload") or ""))
            return {"ok": True}
        registered = _registered(user_id)
        if update_type == "message_callback":
            if registered:
                _handle_callback(update, user_id)
            else:
                callback_id = (update.get("callback") or {}).get("callback_id")
                if callback_id:
                    max_client.answer_callback(callback_id, GUEST_TEXT, buttons=[[{"text": "Открыть ПрактикаПлюс", "url": max_client.miniapp_link()}]])
        elif update_type == "message_created":
            text = _extract_text(update)
            if text.startswith("/start"):
                parts = text.split(maxsplit=1)
                _welcome(user_id, parts[1].strip() if len(parts) > 1 else "")
            elif not registered:
                _guest_reply(user_id)  # unknown sender: start message only, rate limited
            elif text.startswith("/"):
                _handle_command(user_id, text.split()[0].split("@")[0].lower())
            elif text:
                _handle_answer(user_id, text)
    except Exception:
        logger.exception("Failed to handle MAX update: %s", update_type)
    return {"ok": True}
