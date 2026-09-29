"""Internship vacancies: the student feed (ranked by the match index) and the
company's vacancy management (each vacancy has its own candidate pipeline)."""

import json
from typing import Literal

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.auth import get_current_user, require_role
from app.database import get_db
from app.geo import clean_place
from app.models import Application, SearchLog, Skill, Vacancy, vacancy_required_skills
from app.notifications import notify_new_matches_for_vacancy
from app.schemas import ApplicationOut, ErrorOut, VacancyActivePatch, VacancyIn, VacancyOut
from app.services import applications_out, questions_text, set_vacancy_requirements, vacancies_out
from app.skills_catalog import skill_key

router = APIRouter(prefix="/api", tags=["vacancies"])


def _sort_for_student(items: list[VacancyOut]) -> list[VacancyOut]:
    return sorted(items, key=lambda v: (v.match.score if v.match else 0, v.match.potential if v.match else 0, v.created_at), reverse=True)


@router.get("/vacancies", response_model=list[VacancyOut], summary="Лента активных стажировок (для студента — по индексу соответствия)")
def list_vacancies(
    region: str | None = None,
    city: str | None = None,
    tags: str | None = None,
    min_score: float | None = None,
    sort: Literal["match", "new"] = "match",
    current=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """`tags` — comma-separated skills (any of them); `min_score` — only vacancies with at least this index (students)."""
    query = db.query(Vacancy).filter(Vacancy.is_active.is_(True))
    if region:
        query = query.filter(Vacancy.region == region.strip())
    if city:
        query = query.filter(Vacancy.city == city.strip())
    tag_list = [t.strip() for t in tags.split(",") if t.strip()][:10] if tags else []
    if tag_list:
        wanted = {skill_key(t) for t in tag_list}
        skill_ids = [s.skill_id for s in db.query(Skill).all() if skill_key(s.name) in wanted]
        matching = {row.vacancy_id for row in db.query(vacancy_required_skills.c.vacancy_id).filter(vacancy_required_skills.c.skill_id.in_(skill_ids or [-1]))}
        query = query.filter(Vacancy.vacancy_id.in_(matching or {-1}))

    out = vacancies_out(db, query.order_by(Vacancy.created_at.desc()).all(), current)
    if current["role"] == "student":
        if min_score is not None:
            out = [v for v in out if (v.match_score or 0) >= min_score]
        if sort == "match":
            out = _sort_for_student(out)
        if tag_list:
            for tag in tag_list:  # "unmet demand" analytics: what students look for vs what exists
                db.add(SearchLog(student_id=current["user_id"], skill_name=tag[:60], result_count=len(out)))
            db.commit()
    return out


@router.get("/vacancies/mine", response_model=list[VacancyOut], summary="Компания: стажировки организации со статистикой воронки")
def list_my_vacancies(current=Depends(get_current_user), db: Session = Depends(get_db)):
    require_role(current, "hr", detail="Only employers have a vacancy list to manage")
    vacancies = db.query(Vacancy).filter(Vacancy.company_id == current["org_id"]).order_by(Vacancy.is_active.desc(), Vacancy.created_at.desc()).all()
    return vacancies_out(db, vacancies, current)


@router.get("/vacancies/{vacancy_id}", response_model=VacancyOut, summary="Карточка стажировки", responses={404: {"model": ErrorOut}})
def get_vacancy(vacancy_id: int, current=Depends(get_current_user), db: Session = Depends(get_db)):
    vacancy = db.get(Vacancy, vacancy_id)
    owner = vacancy is not None and current["role"] == "hr" and vacancy.company_id == current["org_id"]
    if not vacancy or (not vacancy.is_active and not owner):
        raise HTTPException(status_code=404, detail="Vacancy not found")
    return vacancies_out(db, [vacancy], current)[0]


@router.get("/vacancies/{vacancy_id}/applications", response_model=list[ApplicationOut], summary="Компания: воронка кандидатов конкретной стажировки", responses={404: {"model": ErrorOut}})
def vacancy_pipeline(vacancy_id: int, current=Depends(get_current_user), db: Session = Depends(get_db)):
    require_role(current, "hr", detail="Only employers see candidate pipelines")
    vacancy = db.get(Vacancy, vacancy_id)
    if not vacancy or vacancy.company_id != current["org_id"]:
        raise HTTPException(status_code=404, detail="Vacancy not found")
    apps = (
        db.query(Application)
        .options(joinedload(Application.vacancy).joinedload(Vacancy.company), joinedload(Application.student), joinedload(Application.events))
        .filter(Application.vacancy_id == vacancy_id)
        .all()
    )
    out = applications_out(db, apps, viewer="company")
    out.sort(key=lambda a: (a.match_score, a.created_at), reverse=True)
    return out


def _validate(payload: VacancyIn) -> list[str]:
    if not payload.required_skills and not payload.optional_skills:
        raise HTTPException(status_code=422, detail="Add at least one required skill")
    if not payload.required_skills:
        raise HTTPException(status_code=422, detail="At least one skill must be a core requirement")
    questions = payload.test_questions or ([payload.test_task] if payload.test_task else [])
    return questions


def _apply(db: Session, vacancy: Vacancy, payload: VacancyIn) -> None:
    questions = _validate(payload)
    vacancy.title = payload.title
    vacancy.description = payload.description
    vacancy.test_questions = json.dumps(questions, ensure_ascii=False) if questions else ""
    vacancy.test_task = questions_text(questions) if questions else ""
    vacancy.region, vacancy.city = clean_place(payload.region, payload.city, (vacancy.region or "", vacancy.city or ""))


@router.post("/vacancies", response_model=VacancyOut, status_code=201, summary="Компания: опубликовать стажировку", responses={403: {"model": ErrorOut}, 422: {"model": ErrorOut}})
def create_vacancy(payload: VacancyIn, background_tasks: BackgroundTasks, current=Depends(get_current_user), db: Session = Depends(get_db)):
    require_role(current, "hr", detail="Only HR can create vacancies")
    vacancy = Vacancy(company_id=current["org_id"], title=payload.title)
    _apply(db, vacancy, payload)
    db.add(vacancy)
    db.flush()
    set_vacancy_requirements(db, vacancy, payload.required_skills, payload.optional_skills)
    db.commit()
    db.refresh(vacancy)
    background_tasks.add_task(notify_new_matches_for_vacancy, vacancy.vacancy_id)
    return vacancies_out(db, [vacancy], current)[0]


@router.patch("/vacancies/{vacancy_id}", response_model=VacancyOut, summary="Компания: изменить стажировку", responses={403: {"model": ErrorOut}, 404: {"model": ErrorOut}})
def update_vacancy(vacancy_id: int, payload: VacancyIn, current=Depends(get_current_user), db: Session = Depends(get_db)):
    vacancy = db.get(Vacancy, vacancy_id)
    if not vacancy:
        raise HTTPException(status_code=404, detail="Vacancy not found")
    if current["role"] != "hr" or vacancy.company_id != current["org_id"]:
        raise HTTPException(status_code=403, detail="Not your vacancy")
    _apply(db, vacancy, payload)
    set_vacancy_requirements(db, vacancy, payload.required_skills, payload.optional_skills)
    db.commit()
    db.refresh(vacancy)
    return vacancies_out(db, [vacancy], current)[0]


@router.patch("/vacancies/{vacancy_id}/active", response_model=VacancyOut, summary="Компания: скрыть или опубликовать", responses={403: {"model": ErrorOut}, 404: {"model": ErrorOut}})
def toggle_vacancy_active(vacancy_id: int, payload: VacancyActivePatch, background_tasks: BackgroundTasks, current=Depends(get_current_user), db: Session = Depends(get_db)):
    vacancy = db.get(Vacancy, vacancy_id)
    if not vacancy:
        raise HTTPException(status_code=404, detail="Vacancy not found")
    if current["role"] != "hr" or vacancy.company_id != current["org_id"]:
        raise HTTPException(status_code=403, detail="Not your vacancy")
    was_active = vacancy.is_active
    vacancy.is_active = payload.is_active
    db.commit()
    db.refresh(vacancy)
    if payload.is_active and not was_active:
        background_tasks.add_task(notify_new_matches_for_vacancy, vacancy.vacancy_id)
    return vacancies_out(db, [vacancy], current)[0]
