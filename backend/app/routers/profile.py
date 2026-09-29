"""The caller's own profile: data, consent, skills, progress, portfolio and reset."""

import secrets
from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth import certificate_token, consent_current, get_current_user, hash_password, require_role, verify_password
from app.config import settings
from app.database import get_db
from app.gamification import calculate_points
from app.geo import clean_place, geo
from app.models import Application, Skill, SkillTest, StudentGroup, StudentSkill, TestAttempt, User, Vacancy, vacancy_required_skills
from app.schemas import (
    DirectoryOptInPatch,
    ErrorOut,
    GeoOut,
    PasswordChangeIn,
    PortfolioOut,
    PortfolioPatch,
    ResetOut,
    SkillClaimIn,
    SkillOut,
    StudentDirectoryOptInPatch,
    StudentProgressOut,
    StudentSkillOut,
    UniversityOut,
    UserProfileIn,
    UserProfileOut,
)
from app.services import get_or_create_skill, reset_student_profile, skill_out
from app.skills_catalog import STARTER_SKILLS

router = APIRouter(prefix="/api", tags=["profile"])


def portfolio_url(user: User) -> str:
    return f"{settings.lk_public_url}/p/{user.portfolio_token}" if user.portfolio_public and user.portfolio_token else ""


def profile_out(db: Session, user: User) -> UserProfileOut:
    out = UserProfileOut.model_validate(user)
    out.consent_complete = consent_current(user)
    out.group_locked = bool(user.group_id)
    out.org_id = user.org_owner_id or user.user_id
    out.is_owner = user.role in ("hr", "curator") and not user.org_owner_id
    if user.role in ("hr", "curator"):
        owner = db.get(User, out.org_id) or user
        out.org_name = owner.university if owner.role == "curator" and owner.university else owner.name
    out.portfolio_url = portfolio_url(user)
    if user.role == "student":
        out.points = calculate_points(db, user.user_id)
    return out


def _load_user(db: Session, current: dict) -> User:
    user = db.get(User, current["user_id"])
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.get("/me", response_model=UserProfileOut, summary="Мой профиль")
def get_me(current=Depends(get_current_user), db: Session = Depends(get_db)):
    return profile_out(db, _load_user(db, current))


@router.put(
    "/me",
    response_model=UserProfileOut,
    summary="Сохранить профиль (студент задаёт роль один раз при регистрации; код группы заполняет вуз, группу, регион и город)",
    responses={403: {"model": ErrorOut}, 422: {"model": ErrorOut}},
)
def update_me(payload: UserProfileIn, current=Depends(get_current_user), db: Session = Depends(get_db)):
    user = _load_user(db, current)
    # Roles are security boundaries: a MAX account may become a student once; no role changes later.
    if user.role and payload.role != user.role:
        raise HTTPException(status_code=403, detail="Account role cannot be changed")
    if not user.role and payload.role != "student":
        raise HTTPException(status_code=403, detail="New MAX accounts can only become students")

    user.role = payload.role
    user.name = payload.name
    user.contact_info = payload.contact_info
    user.phone = payload.phone

    group = None
    if payload.role == "student" and payload.group_code:
        group = db.query(StudentGroup).filter(StudentGroup.invite_code == payload.group_code).first()
        if not group:
            raise HTTPException(status_code=422, detail="Invite link is not valid")
    elif payload.role == "student" and user.group_id:
        group = db.get(StudentGroup, user.group_id)

    if group:
        # Joined through the university's group invite: these fields belong to the university.
        user.group_id, user.university, user.group, user.region, user.city = group.group_id, group.university, group.name, group.region, group.city
    elif payload.role == "curator" and user.org_owner_id:
        user.region, user.city = clean_place(payload.region, payload.city, (user.region or "", user.city or ""))
    else:
        if payload.role == "curator" and not payload.university:
            raise HTTPException(status_code=422, detail="University is required for a curator account")
        if payload.role == "curator" and (user.university or "").strip().lower() != payload.university.strip().lower():
            user.directory_opt_in = False  # university consent does not carry over
        user.university = payload.university
        user.group = payload.group
        user.region, user.city = clean_place(payload.region, payload.city, (user.region or "", user.city or ""))

    now = datetime.utcnow()
    if payload.accept_terms:
        user.terms_accepted_at, user.terms_version = now, settings.terms_version
    if payload.accept_privacy:
        user.privacy_accepted_at, user.privacy_version = now, settings.privacy_version
    if payload.role == "student" and not consent_current(user):
        db.rollback()
        raise HTTPException(status_code=422, detail="Accept the terms and personal data consent to create a profile")
    db.commit()
    db.refresh(user)
    return profile_out(db, user)


@router.post("/me/reset", response_model=ResetOut, summary="Полный сброс профиля студента — для повторного прохождения сценария", responses={403: {"model": ErrorOut}})
def reset_me(current=Depends(get_current_user), db: Session = Depends(get_db)):
    user = _load_user(db, current)
    if user.role not in ("student", "", None):
        raise HTTPException(status_code=403, detail="Only student profiles can be reset")
    if user.user_id.startswith("demo-"):
        raise HTTPException(status_code=403, detail="Shared demo profiles cannot be reset")
    removed_skills, removed_apps = reset_student_profile(db, user)
    db.commit()
    db.refresh(user)
    return ResetOut(removed_skills=removed_skills, removed_applications=removed_apps, profile=profile_out(db, user))


@router.patch("/me/discoverable", response_model=UserProfileOut, summary="Студент: разрешить работодателям находить профиль")
def set_student_discoverable(payload: StudentDirectoryOptInPatch, current=Depends(get_current_user), db: Session = Depends(get_db)):
    require_role(current, "student", detail="Only students can choose profile visibility")
    user = _load_user(db, current)
    user.student_directory_opt_in = payload.student_directory_opt_in
    db.commit()
    return profile_out(db, user)


@router.patch("/me/portfolio", response_model=UserProfileOut, summary="Студент: публичная визитка-портфолио по ссылке")
def set_portfolio(payload: PortfolioPatch, current=Depends(get_current_user), db: Session = Depends(get_db)):
    require_role(current, "student", detail="Only students have a portfolio")
    user = _load_user(db, current)
    user.portfolio_public = payload.public
    user.portfolio_show_contact = payload.show_contact
    if payload.public and not user.portfolio_token:
        user.portfolio_token = secrets.token_urlsafe(9)
    db.commit()
    return profile_out(db, user)


@router.get("/public/portfolio/{token}", response_model=PortfolioOut, tags=["public"], summary="Публичная визитка студента (без авторизации)", responses={404: {"model": ErrorOut}})
def public_portfolio(token: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.portfolio_token == token, User.portfolio_public.is_(True)).first()
    if not user or user.role != "student":
        raise HTTPException(status_code=404, detail="Portfolio not found")
    skills = [skill_out(link) for link in user.skills]
    passed = [
        t.title
        for t in db.query(SkillTest).join(TestAttempt, TestAttempt.test_id == SkillTest.test_id).filter(TestAttempt.student_id == user.user_id, TestAttempt.passed.is_(True))
    ]
    return PortfolioOut(
        name=user.name, avatar_url=user.avatar_url or "", university=user.university or "", group=user.group or "", city=user.city or "",
        region=user.region or "", contact=(user.contact_info or user.phone or "") if user.portfolio_show_contact else "",
        verified=[s for s in skills if s.status == "verified"], employer_review=[s for s in skills if s.status == "employer_review"],
        claimed=[s.name for s in skills if s.status == "claimed"], tests_passed=sorted(set(passed)), points=calculate_points(db, user.user_id),
        certificate_urls={
            s.name: f"{settings.lk_public_url}/certificate/{user.user_id}/{s.skill_id}/{certificate_token(user.user_id, s.skill_id)}"
            for s in skills if s.status == "verified"
        },
    )


@router.patch("/me/directory-opt-in", response_model=UserProfileOut, summary="Вуз: открыть каталог студентов работодателям")
def set_directory_opt_in(payload: DirectoryOptInPatch, current=Depends(get_current_user), db: Session = Depends(get_db)):
    require_role(current, "curator", detail="Only curators can opt their university in")
    owner = db.get(User, current["org_id"])
    if payload.directory_opt_in and not (owner.university or "").strip():
        raise HTTPException(status_code=422, detail="Set your university in organization settings first")
    owner.directory_opt_in = payload.directory_opt_in
    db.commit()
    return profile_out(db, _load_user(db, current))


@router.patch("/me/password", status_code=204, summary="Сменить пароль сотрудника", responses={422: {"model": ErrorOut}})
def change_password(payload: PasswordChangeIn, current=Depends(get_current_user), db: Session = Depends(get_db)):
    require_role(current, "hr", "curator", detail="Password changes are available to organization accounts")
    user = _load_user(db, current)
    if user.user_id.startswith("demo-"):
        raise HTTPException(status_code=403, detail="Password of a shared demo account cannot be changed")
    if not user.password_hash or not verify_password(payload.current_password, user.password_hash):
        raise HTTPException(status_code=422, detail="Current password is incorrect")
    user.password_hash = hash_password(payload.new_password)
    db.commit()
    return Response(status_code=204)


# ---- student skills ----------------------------------------------------------------------

@router.get("/me/skills", response_model=list[StudentSkillOut], summary="Мои навыки и решения вуза по ним")
def my_skills(current=Depends(get_current_user), db: Session = Depends(get_db)):
    require_role(current, "student", detail="Only students have a skills profile")
    rows = db.query(StudentSkill).filter(StudentSkill.student_id == current["user_id"]).all()
    return [skill_out(row) for row in rows]


@router.post("/me/skills", response_model=StudentSkillOut, summary="Заявить навык (вуз проверит)")
def claim_skill(payload: SkillClaimIn, current=Depends(get_current_user), db: Session = Depends(get_db)):
    require_role(current, "student", detail="Only students can claim skills")
    if db.query(StudentSkill).filter(StudentSkill.student_id == current["user_id"]).count() >= 40:
        raise HTTPException(status_code=422, detail="Too many skills in one profile")
    for attempt in range(2):
        try:
            skill = get_or_create_skill(db, payload.skill_name)
            link = db.query(StudentSkill).filter(StudentSkill.student_id == current["user_id"], StudentSkill.skill_id == skill.skill_id).first()
            if not link:
                link = StudentSkill(student_id=current["user_id"], skill_id=skill.skill_id, is_verified=False, status="claimed")
                db.add(link)
            db.commit()
            db.refresh(link)
            return skill_out(link)
        except IntegrityError:
            db.rollback()  # a parallel request created the same tag/link first — retry once
            if attempt:
                raise HTTPException(status_code=409, detail="Skill is being added, try again")


@router.delete("/me/skills/{skill_id}", status_code=204, summary="Удалить заявленный навык", responses={404: {"model": ErrorOut}, 409: {"model": ErrorOut}})
def remove_my_skill(skill_id: int, current=Depends(get_current_user), db: Session = Depends(get_db)):
    require_role(current, "student", detail="Only students can edit their skills profile")
    row = db.query(StudentSkill).filter(StudentSkill.student_id == current["user_id"], StudentSkill.skill_id == skill_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Skill not found in your profile")
    if row.is_verified or row.status in ("verified", "employer_review"):
        raise HTTPException(status_code=409, detail="A verified skill can only be withdrawn by the curator")
    db.delete(row)
    db.commit()
    return Response(status_code=204)


@router.get("/me/progress", response_model=StudentProgressOut, summary="Баллы, уровень и достижения студента")
def my_progress(current=Depends(get_current_user), db: Session = Depends(get_db)):
    require_role(current, "student", detail="Only students have achievements")
    user = _load_user(db, current)
    applications = db.query(Application).filter(Application.student_id == current["user_id"]).all()
    verified = db.query(StudentSkill).filter(StudentSkill.student_id == current["user_id"], StudentSkill.is_verified.is_(True)).count()
    answered = sum(1 for app in applications if app.test_answer or app.test_answers)
    accepted = sum(1 for app in applications if app.status == "accepted" and not (app.decision_visible_at and app.decision_visible_at > datetime.utcnow()))
    profile_ready = bool(user.university and user.group and (user.region or user.city))
    achievements = [
        {"key": "profile", "title": "Маршрут задан", "description": "Заполни вуз, группу и город", "earned": profile_ready, "progress": 1 if profile_ready else 0, "goal": 1},
        {"key": "verified", "title": "Навыки подтверждены", "description": "Получи подтверждение вуза для трёх навыков", "earned": verified >= 3, "progress": min(verified, 3), "goal": 3},
        {"key": "first-application", "title": "Первый отклик", "description": "Откликнись на стажировку, которая тебе подходит", "earned": len(applications) > 0, "progress": min(len(applications), 1), "goal": 1},
        {"key": "task", "title": "Дело за малым", "description": "Отправь ответ на задание работодателя", "earned": answered > 0, "progress": min(answered, 1), "goal": 1},
        {"key": "offer", "title": "Есть предложение", "description": "Получи приглашение от работодателя", "earned": accepted > 0, "progress": min(accepted, 1), "goal": 1},
    ]
    points = calculate_points(db, current["user_id"])
    return StudentProgressOut(points=points, level=points // 50 + 1, next_level_points=(points // 50 + 1) * 50, achievements=achievements)


# ---- catalogues ---------------------------------------------------------------------------

@router.get("/skills", response_model=list[SkillOut], summary="Каталог навыков")
def list_skills(scope: Literal["all", "vacancies"] = "all", db: Session = Depends(get_db)):
    """`scope=vacancies` — tags required by active vacancies (feed filters);
    `all` — tags in real use plus the starter set, so one student's typo in a
    custom skill does not end up in everyone's onboarding list."""
    in_vacancies = (
        select(vacancy_required_skills.c.skill_id)
        .join(Vacancy, Vacancy.vacancy_id == vacancy_required_skills.c.vacancy_id)
        .where(Vacancy.is_active.is_(True))
    )
    if scope == "vacancies":
        return db.query(Skill).filter(Skill.skill_id.in_(in_vacancies)).order_by(func.lower(Skill.name)).all()
    verified = select(StudentSkill.skill_id).where(StudentSkill.is_verified.is_(True))
    return (
        db.query(Skill)
        .filter(or_(Skill.skill_id.in_(in_vacancies), Skill.skill_id.in_(verified), Skill.name.in_(STARTER_SKILLS)))
        .order_by(func.lower(Skill.name))
        .all()
    )


@router.get("/universities", response_model=list[UniversityOut], summary="Вузы на платформе (выбор при регистрации)")
def list_universities(current=Depends(get_current_user), db: Session = Depends(get_db)):
    names: dict[str, dict] = {}
    for (name,) in db.query(User.university).filter(User.role == "curator"):
        if name and name.strip():
            names.setdefault(name.strip().lower(), {"name": name.strip(), "students": 0, "has_curator": True})
    for name, count in db.query(User.university, func.count(User.user_id)).filter(User.role == "student").group_by(User.university):
        key = (name or "").strip().lower()
        if key in names:
            names[key]["students"] += count
    return sorted((UniversityOut(**v) for v in names.values()), key=lambda u: (-u.students, u.name))


@router.get("/geo", response_model=GeoOut, tags=["public"], summary="Справочник регионов и городов России")
def get_geo():
    return geo()
