"""Applications: one-tap apply → test questions in the MAX chat → answers
(chat or mini app) → employer decision with an undo window → the student is
notified with next steps."""

import csv
import io
import json
from datetime import datetime, timedelta

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Response
from sqlalchemy.orm import Session, joinedload

from app.auth import get_current_user, require_role
from app.config import settings
from app.database import get_db
from app.max_client import max_client
from app.models import Application, User, Vacancy
from app.schemas import ApplicationAnswerIn, ApplicationOut, ApplicationStatusPatch, ApplyIn, ErrorOut
from app.services import (
    STATUS_LABEL,
    applications_out,
    cancel_pending_messages,
    log_event,
    next_step_text,
    questions_of,
    questions_text,
    schedule_message,
    visible_status,
)

router = APIRouter(prefix="/api", tags=["applications"])


def _load_app(db: Session, app_id: int) -> Application | None:
    return (
        db.query(Application)
        .options(joinedload(Application.vacancy).joinedload(Vacancy.company), joinedload(Application.student), joinedload(Application.events))
        .filter(Application.app_id == app_id)
        .first()
    )


def _own_company_app(db: Session, current: dict, app_id: int) -> Application:
    application = _load_app(db, app_id)
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")
    if current["role"] != "hr" or application.vacancy.company_id != current["org_id"]:
        raise HTTPException(status_code=403, detail="Not your vacancy")
    return application


@router.post("/applications", response_model=ApplicationOut, summary="Студент: откликнуться (идемпотентно)", responses={403: {"model": ErrorOut}, 404: {"model": ErrorOut}})
def apply(payload: ApplyIn, background_tasks: BackgroundTasks, current=Depends(get_current_user), db: Session = Depends(get_db)):
    require_role(current, "student", detail="Only students can apply")
    vacancy = db.get(Vacancy, payload.vacancy_id)
    if not vacancy or not vacancy.is_active:
        raise HTTPException(status_code=404, detail="Vacancy not found")
    existing = db.query(Application).filter(Application.vacancy_id == vacancy.vacancy_id, Application.student_id == current["user_id"]).first()
    if existing:
        return applications_out(db, [_load_app(db, existing.app_id)])[0]

    application = Application(vacancy_id=vacancy.vacancy_id, student_id=current["user_id"], status="pending")
    db.add(application)
    db.flush()
    log_event(db, application, "created", "Отклик отправлен работодателю")
    db.commit()

    out = applications_out(db, [_load_app(db, application.app_id)])[0]
    questions = questions_of(vacancy)
    company = vacancy.company.name if vacancy.company else "компания"
    if questions:
        if len(questions) == 1:
            how = f"Ответьте прямо в этот чат — если у вас несколько откликов, начните сообщение с #{application.app_id}."
        else:
            how = "Удобнее ответить в мини-приложении (раздел «Отклики») — там отдельное поле для каждого вопроса. Можно и одним сообщением сюда, пронумеровав ответы."
        background_tasks.add_task(
            max_client.send_message, current["user_id"],
            f"Вы откликнулись на «{vacancy.title}» ({company}). Индекс соответствия: {out.match_score}%.\n\n"
            f"Тестовое задание ({len(questions)} {'вопрос' if len(questions) == 1 else 'вопроса'}):\n{questions_text(questions)}\n\n{how}",
            [[{"text": "Ответить в мини-приложении", "url": max_client.miniapp_link("apps")}]],
        )
    else:
        background_tasks.add_task(max_client.send_message, current["user_id"], f"Отклик на «{vacancy.title}» отправлен. Индекс соответствия: {out.match_score}%. Решение компании придёт в этот чат.")
    return out


@router.post("/applications/{app_id}/answer", response_model=ApplicationOut, summary="Студент: ответы на вопросы тестового задания", responses={404: {"model": ErrorOut}, 409: {"model": ErrorOut}, 422: {"model": ErrorOut}})
def answer_application(app_id: int, payload: ApplicationAnswerIn, current=Depends(get_current_user), db: Session = Depends(get_db)):
    require_role(current, "student", detail="Only students can submit task answers")
    application = _load_app(db, app_id)
    if not application or application.student_id != current["user_id"]:
        raise HTTPException(status_code=404, detail="Application not found")
    if visible_status(application) != "pending" or application.status != "pending":
        raise HTTPException(status_code=409, detail="The application is no longer accepting answers")
    questions = questions_of(application.vacancy)
    if not questions:
        raise HTTPException(status_code=409, detail="This application has no test task")
    answers = [a.strip() for a in payload.answers] if payload.answers else [payload.answer.strip()]
    if not any(answers):
        raise HTTPException(status_code=422, detail="Answer cannot be empty")
    if payload.answers and (len(answers) != len(questions) or not all(answers)):
        raise HTTPException(status_code=422, detail="Answer every question")
    if any(len(a) > 10000 for a in answers):
        raise HTTPException(status_code=422, detail="Answer is too long")
    first = not (application.test_answer or application.test_answers)
    application.test_answers = json.dumps(answers, ensure_ascii=False)
    application.test_answer = answers[0] if len(answers) == 1 else "\n\n".join(f"{i}. {a}" for i, a in enumerate(answers, 1))
    application.updated_at = datetime.utcnow()
    log_event(db, application, "answered", "Ответ на задание отправлен" if first else "Ответ на задание обновлён")
    db.commit()
    return applications_out(db, [_load_app(db, app_id)])[0]


@router.get("/applications", response_model=list[ApplicationOut], summary="Отклики: студент — свои, компания — на свои стажировки (фильтр vacancy_id)")
def list_applications(vacancy_id: int | None = None, current=Depends(get_current_user), db: Session = Depends(get_db)):
    query = db.query(Application).options(joinedload(Application.vacancy).joinedload(Vacancy.company), joinedload(Application.student), joinedload(Application.events))
    if current["role"] == "hr":
        query = query.join(Vacancy).filter(Vacancy.company_id == current["org_id"])
        if vacancy_id:
            query = query.filter(Application.vacancy_id == vacancy_id)
        out = applications_out(db, query.all(), viewer="company")
        out.sort(key=lambda a: (a.match_score, a.created_at), reverse=True)
        return out
    if current["role"] == "student":
        out = applications_out(db, query.filter(Application.student_id == current["user_id"]).all())
        out.sort(key=lambda a: a.updated_at, reverse=True)
        return out
    raise HTTPException(status_code=403, detail="Curators don't have an application inbox")


@router.get("/applications/export", summary="Компания: выгрузка откликов в CSV (Excel)", response_class=Response, responses={200: {"content": {"text/csv": {}}}})
def export_applications_csv(vacancy_id: int | None = None, current=Depends(get_current_user), db: Session = Depends(get_db)):
    """`;` delimiter and UTF-8 BOM so it opens by double-click in Excel with Russian locale."""
    require_role(current, "hr", detail="Only employers can export applications")
    query = db.query(Application).join(Vacancy).filter(Vacancy.company_id == current["org_id"])
    if vacancy_id:
        query = query.filter(Application.vacancy_id == vacancy_id)
    buf = io.StringIO()
    writer = csv.writer(buf, delimiter=";")
    writer.writerow(["ФИО", "Телефон", "Контакт", "Вуз", "Группа", "Стажировка", "Статус", "Индекс", "Подтверждено вузом", "Не хватает", "Ответ на задание", "Дата отклика"])
    for a in applications_out(db, query.all(), viewer="company"):
        writer.writerow([
            a.student_name, a.student_phone, a.student_contact, a.student_university, a.student_group, a.vacancy_title, STATUS_LABEL.get(a.status, a.status),
            f"{a.match_score}%", f"{a.match.verified_score}%" if a.match else "", ", ".join(a.match.missing if a.match else []),
            "Да" if (a.test_answer or a.test_answers) else "Нет", a.created_at.strftime("%d.%m.%Y"),
        ])
    return Response(content=buf.getvalue().encode("utf-8-sig"), media_type="text/csv", headers={"Content-Disposition": "attachment; filename=otkliki.csv"})


@router.patch(
    "/applications/{app_id}",
    response_model=ApplicationOut,
    summary="Компания: решение по отклику. Студент увидит его через окно отмены (по умолчанию 90 с)",
    responses={403: {"model": ErrorOut}, 404: {"model": ErrorOut}, 422: {"model": ErrorOut}},
)
def patch_application(app_id: int, payload: ApplicationStatusPatch, current=Depends(get_current_user), db: Session = Depends(get_db)):
    application = _own_company_app(db, current, app_id)
    if payload.status == application.status and not payload.next_step and not payload.message:
        return applications_out(db, [application], viewer="company")[0]

    now = datetime.utcnow()
    cancel_pending_messages(db, app_id, "decision")
    vacancy = application.vacancy
    company = vacancy.company
    if not (application.decision_visible_at and application.decision_visible_at > now):
        application.previous_status = application.status  # what the student currently sees
    application.status = payload.status
    application.updated_at = now
    log_event(db, application, payload.status, STATUS_LABEL[payload.status])

    if payload.status in ("accepted", "rejected"):
        if payload.status == "accepted":
            step = (payload.next_step.model_dump() if payload.next_step else {"format": "call", "message": ""})
            if not step.get("contact_phone") and company:
                step["contact_phone"] = company.phone or ""
            if not step.get("contact_name"):
                hr = db.get(User, current["user_id"])
                step["contact_name"] = f"{hr.name}" if hr and hr.user_id != company.user_id else (company.person_name or "")
            application.next_step = json.dumps(step, ensure_ascii=False)
            text = next_step_text(step, company.name if company else "Компания", vacancy.title)
        else:
            application.next_step = ""
            custom = payload.message.strip()
            text = custom or f"По стажировке «{vacancy.title}» компания {company.name if company else ''} выбрала другого кандидата. Не расстраивайтесь — в ленте есть другие подходящие стажировки."
        application.decision_visible_at = now + timedelta(seconds=settings.decision_grace_seconds)
        schedule_message(db, application.student_id, text, [[{"text": "Открыть отклик", "url": max_client.miniapp_link("apps")}]], delay_seconds=settings.decision_grace_seconds, app_id=app_id, kind="decision")
    else:
        application.decision_visible_at = None
        application.next_step = ""
    db.commit()
    return applications_out(db, [_load_app(db, app_id)], viewer="company")[0]


@router.post("/applications/{app_id}/undo", response_model=ApplicationOut, summary="Компания: отменить решение, пока окно отмены не истекло", responses={404: {"model": ErrorOut}, 409: {"model": ErrorOut}})
def undo_decision(app_id: int, current=Depends(get_current_user), db: Session = Depends(get_db)):
    application = _own_company_app(db, current, app_id)
    now = datetime.utcnow()
    if not (application.decision_visible_at and application.decision_visible_at > now):
        raise HTTPException(status_code=409, detail="The decision has already been delivered")
    cancel_pending_messages(db, app_id, "decision")
    application.status = application.previous_status or "pending"
    application.decision_visible_at = None
    application.next_step = ""
    application.updated_at = now
    log_event(db, application, "undone", "Решение отменено до отправки студенту")
    db.commit()
    return applications_out(db, [_load_app(db, app_id)], viewer="company")[0]
