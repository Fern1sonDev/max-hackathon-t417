"""Shared domain helpers: organisation scoping, privacy scope of the student
roster, batched serialisation of vacancies/applications with the match index,
the application timeline, delayed bot messages (undo window) and profile reset.

Serialisers take lists and load skills/requirements in bulk (see
app/match_score.py load_* helpers), so a feed or a pipeline costs a constant
number of queries instead of one per card.
"""

import json
from datetime import datetime, timedelta

from fastapi import HTTPException
from sqlalchemy import delete, func, insert, or_
from sqlalchemy.orm import Session

from app.config import settings
from app.match_score import MatchResult, compute_match, load_requirements, load_skill_sets
from app.models import (
    Application,
    ApplicationEvent,
    NotifiedMatch,
    OutboxMessage,
    PassiveNudge,
    SearchLog,
    Skill,
    StudentSkill,
    TestAttempt,
    User,
    Vacancy,
    vacancy_required_skills,
)
from app.schemas import (
    ApplicationEventOut,
    ApplicationOut,
    MatchItemOut,
    MatchOut,
    NextStepOut,
    StudentOut,
    StudentSkillOut,
    VacancyOut,
    VacancyStats,
)
from app.skills_catalog import canonical_name, skill_key

STATUS_LABEL = {
    "pending": "На рассмотрении",
    "accepted": "Приглашение на следующий этап",
    "rejected": "Отказ",
    "missed": "Работодатель не ответил вовремя",
}

NEXT_STEP_FORMAT = {
    "online": "Онлайн-собеседование",
    "office": "Собеседование в офисе",
    "call": "Созвон с HR",
    "start": "Выход на стажировку",
}


def same_university(a: str, b: str) -> bool:
    return bool(a and b) and a.strip().casefold() == b.strip().casefold()


def _university_spellings(db: Session, universities: set[str]) -> set[str]:
    """Every stored spelling of the given universities, compared in Python:
    SQL lower() does not fold Cyrillic under the C locale of the alpine
    PostgreSQL image (nor in SQLite), so "скфу" would miss "СКФУ" there."""
    wanted = {u.strip().casefold() for u in universities if u and u.strip()}
    if not wanted:
        return set()
    stored = {row[0] for row in db.query(User.university).filter(User.role == "student").distinct() if row[0]}
    return {u for u in stored if u.strip().casefold() in wanted}


def safe_avatar_url(value: str | None) -> str:
    """Only plain https image links from MAX are stored and rendered."""
    value = (value or "").strip()
    return value if value.startswith("https://") and len(value) <= 500 and " " not in value else ""


def org_owner(db: Session, current: dict) -> User:
    owner = db.get(User, current["org_id"])
    if not owner:
        raise HTTPException(status_code=404, detail="Organisation not found")
    return owner


# ---- skills --------------------------------------------------------------------------

def get_or_create_skill(db: Session, raw_name: str) -> Skill:
    """Case/alias-insensitive lookup so "linux" and "Linux" are one skill."""
    name = canonical_name(raw_name)
    key = skill_key(name)
    skill = db.query(Skill).filter(func.lower(Skill.name) == name.lower()).first()
    if not skill:
        skill = next((s for s in db.query(Skill).all() if skill_key(s.name) == key), None)
    if not skill:
        skill = Skill(name=name)
        db.add(skill)
        db.flush()
    return skill


def set_vacancy_requirements(db: Session, vacancy: Vacancy, core: list[str], optional: list[str]) -> None:
    core_skills = [get_or_create_skill(db, name) for name in core]
    core_ids = {skill.skill_id for skill in core_skills}
    optional_skills = [s for s in (get_or_create_skill(db, name) for name in optional) if s.skill_id not in core_ids]
    db.execute(delete(vacancy_required_skills).where(vacancy_required_skills.c.vacancy_id == vacancy.vacancy_id))
    rows = [{"vacancy_id": vacancy.vacancy_id, "skill_id": s.skill_id, "is_core": True} for s in core_skills]
    rows += [{"vacancy_id": vacancy.vacancy_id, "skill_id": s.skill_id, "is_core": False} for s in {s.skill_id: s for s in optional_skills}.values()]
    if rows:
        db.execute(insert(vacancy_required_skills), rows)
    db.expire(vacancy, ["required_skills"])


def skill_out(link: StudentSkill) -> StudentSkillOut:
    status = "verified" if link.is_verified else (link.status or "claimed")
    return StudentSkillOut(
        skill_id=link.skill_id,
        name=link.skill.name,
        is_verified=link.is_verified,
        status=status,
        comment=link.comment or "",
        reviewed_by=link.verifier.name if link.verifier and status != "claimed" else "",
        reviewed_at=link.verified_at if status != "claimed" else None,
    )


# ---- test task questions ---------------------------------------------------------------

def questions_of(vacancy: Vacancy | None) -> list[str]:
    if not vacancy:
        return []
    try:
        items = json.loads(vacancy.test_questions or "[]")
        if isinstance(items, list) and items:
            return [str(q) for q in items]
    except ValueError:
        pass
    return [vacancy.test_task] if vacancy.test_task else []


def questions_text(questions: list[str]) -> str:
    if len(questions) == 1:
        return questions[0]
    return "\n".join(f"{i}. {q}" for i, q in enumerate(questions, 1))


def answers_of(app: Application) -> list[str]:
    try:
        items = json.loads(app.test_answers or "[]")
        if isinstance(items, list) and items:
            return [str(a) for a in items]
    except ValueError:
        pass
    return [app.test_answer] if app.test_answer else []


# ---- privacy scope ---------------------------------------------------------------------

def visible_student_query(db: Session, current: dict):
    """The student roster visible to the caller — shared so every endpoint
    applies the same privacy rule.

    curator: students of the organisation's university.
    hr: applicants to the company's vacancies, union students who personally
        opted into discovery at a university that opened its catalogue.
    """
    if current["role"] == "curator":
        university = org_owner(db, current).university
        query = db.query(User).filter(User.role == "student")
        spellings = _university_spellings(db, {university})
        if spellings:
            return query.filter(User.university.in_(spellings))
        return query.filter(False)  # an unconfigured account must not see every student

    if current["role"] == "hr":
        applicant_ids = {
            row.student_id
            for row in db.query(Application.student_id).join(Vacancy).filter(Vacancy.company_id == current["org_id"])
        }
        opted_in = {row.university for row in db.query(User.university).filter(User.role == "curator", User.directory_opt_in.is_(True))}
        spellings = _university_spellings(db, opted_in)
        discoverable_ids = set()
        if spellings:
            discoverable_ids = {
                row.user_id
                for row in db.query(User.user_id).filter(
                    User.role == "student", User.student_directory_opt_in.is_(True), User.university.in_(spellings)
                )
            }
        ids = applicant_ids | discoverable_ids
        query = db.query(User).filter(User.role == "student")
        return query.filter(User.user_id.in_(ids)) if ids else query.filter(False)

    raise HTTPException(status_code=403, detail="Only employers and curators can view students")


def ensure_curator_owns(db: Session, current: dict, student_id: str) -> User:
    student = db.get(User, student_id)
    if not student or student.role != "student" or not same_university(student.university, org_owner(db, current).university):
        raise HTTPException(status_code=404, detail="Student not found in your university")
    return student


def students_out(db: Session, students: list[User], include_phone: bool = False) -> list[StudentOut]:
    ids = [s.user_id for s in students]
    counts: dict[str, tuple[int, int]] = {}
    if ids:
        for student_id, status in db.query(Application.student_id, Application.status).filter(Application.student_id.in_(ids)):
            total, accepted = counts.get(student_id, (0, 0))
            counts[student_id] = (total + 1, accepted + (1 if status == "accepted" else 0))
    out = []
    now = datetime.utcnow()
    for s in students:
        total, accepted = counts.get(s.user_id, (0, 0))
        passive = bool(s.created_at and (now - s.created_at).total_seconds() / 86400 >= settings.passive_days and total == 0)
        out.append(
            StudentOut(
                user_id=s.user_id, name=s.name, contact_info=s.contact_info or "", phone=(s.phone or "") if include_phone else "",
                university=s.university or "", group=s.group or "", group_id=s.group_id, region=s.region or "", city=s.city or "",
                skills=[skill_out(link) for link in s.skills], is_passive=passive, avatar_url=s.avatar_url or "",
                applications=total, accepted=accepted,
            )
        )
    return out


def student_out(db: Session, s: User, include_phone: bool = False) -> StudentOut:
    return students_out(db, [s], include_phone)[0]


# ---- match serialisation ----------------------------------------------------------------

def match_out(result: MatchResult) -> MatchOut:
    return MatchOut(
        score=result.score,
        verified_score=result.verified_score,
        potential=result.potential,
        level=result.level,
        items=[MatchItemOut(skill=i.skill, is_core=i.is_core, status=i.status, via=i.via) for i in result.items],
        missing=result.missing,
        missing_core=result.missing_core,
    )


def _decision_pending(app: Application, now: datetime | None = None) -> bool:
    return bool(app.decision_visible_at and app.decision_visible_at > (now or datetime.utcnow()))


def visible_status(app: Application) -> str:
    """What the student sees: a decision inside its undo window isn't visible yet."""
    return (app.previous_status or "pending") if _decision_pending(app) else app.status


def vacancies_out(db: Session, vacancies: list[Vacancy], current: dict | None) -> list[VacancyOut]:
    requirements = load_requirements(db, [v.vacancy_id for v in vacancies])
    is_student = bool(current and current["role"] == "student")
    skills = load_skill_sets(db, [current["user_id"]])[current["user_id"]] if is_student else None
    my_status: dict[int, str] = {}
    if is_student:
        my_status = {a.vacancy_id: visible_status(a) for a in db.query(Application).filter(Application.student_id == current["user_id"])}
    stats: dict[int, VacancyStats] = {}
    if current and current["role"] == "hr":
        own = [v.vacancy_id for v in vacancies if v.company_id == current["org_id"]]
        if own:
            apps = db.query(Application).filter(Application.vacancy_id.in_(own)).all()
            app_skills = load_skill_sets(db, list({a.student_id for a in apps}))
            day_ago = datetime.utcnow() - timedelta(hours=24)
            for vid in own:
                subset = [a for a in apps if a.vacancy_id == vid]
                scores = [compute_match(app_skills[a.student_id], requirements[vid]).score for a in subset]
                stats[vid] = VacancyStats(
                    total=len(subset),
                    pending=sum(a.status == "pending" for a in subset),
                    accepted=sum(a.status == "accepted" for a in subset),
                    rejected=sum(a.status == "rejected" for a in subset),
                    missed=sum(a.status == "missed" for a in subset),
                    answered=sum(bool(a.test_answer or a.test_answers) for a in subset),
                    new_24h=sum(a.created_at >= day_ago for a in subset),
                    avg_match=round(sum(scores) / len(scores), 1) if scores else 0.0,
                )

    out = []
    for vacancy in vacancies:
        reqs = requirements[vacancy.vacancy_id]
        owner = bool(current and current["role"] == "hr" and current["org_id"] == vacancy.company_id)
        result = compute_match(skills, reqs) if is_student else None
        questions = questions_of(vacancy)
        out.append(
            VacancyOut(
                vacancy_id=vacancy.vacancy_id,
                company_id=vacancy.company_id,
                company_name=vacancy.company.name if vacancy.company else "",
                title=vacancy.title,
                description=vacancy.description or "",
                # the exercise stays hidden until the student applies
                test_task=(vacancy.test_task or "") if owner else "",
                test_questions=questions if owner else [],
                test_questions_count=len(questions),
                has_test_task=bool(questions),
                region=vacancy.region or "",
                city=vacancy.city or "",
                is_active=vacancy.is_active,
                required_skills=[r.name for r in reqs],
                core_skills=[r.name for r in reqs if r.is_core],
                optional_skills=[r.name for r in reqs if not r.is_core],
                created_at=vacancy.created_at,
                applications_count=stats[vacancy.vacancy_id].total if owner and vacancy.vacancy_id in stats else (0 if owner else None),
                stats=stats.get(vacancy.vacancy_id) if owner else None,
                match_score=result.score if result else None,
                missing_skills=result.missing if result else [],
                match=match_out(result) if result else None,
                my_application_status=my_status.get(vacancy.vacancy_id) if is_student else None,
            )
        )
    return out


def is_overdue(app: Application) -> bool:
    return app.status == "pending" and (datetime.utcnow() - app.updated_at).total_seconds() / 3600 >= settings.sla_warn_hours


def applications_out(db: Session, apps: list[Application], viewer: str = "student") -> list[ApplicationOut]:
    """viewer: "student" (own applications — decisions inside the undo window
    stay hidden), "company" (full candidate card incl. phone), "bot"."""
    requirements = load_requirements(db, list({a.vacancy_id for a in apps}))
    skills = load_skill_sets(db, list({a.student_id for a in apps}))
    now = datetime.utcnow()
    out = []
    for app in apps:
        reqs = requirements.get(app.vacancy_id, [])
        result = compute_match(skills[app.student_id], reqs)
        student = app.student
        company = app.vacancy.company if app.vacancy else None
        pending_decision = _decision_pending(app, now)
        status = visible_status(app) if viewer != "company" else app.status
        next_step = None
        if app.next_step and status == "accepted":
            try:
                next_step = NextStepOut(**json.loads(app.next_step))
            except (ValueError, TypeError):
                next_step = None
        company_view = viewer == "company"
        events = list(app.events)
        if not company_view:
            # The student never sees decisions that were undone or are still inside the undo window.
            visible: list[ApplicationEvent] = []
            for e in events:
                if e.kind == "undone":
                    if visible and visible[-1].kind in ("accepted", "rejected"):
                        visible.pop()
                    continue
                visible.append(e)
            if pending_decision and visible and visible[-1].kind in ("accepted", "rejected"):
                visible.pop()
            events = visible
        out.append(
            ApplicationOut(
                app_id=app.app_id,
                vacancy_id=app.vacancy_id,
                vacancy_title=app.vacancy.title if app.vacancy else "",
                company_name=company.name if company else "",
                student_id=app.student_id,
                student_name=student.name if student else "",
                student_university=(student.university or "") if student else "",
                student_group=(student.group or "") if student else "",
                student_contact=(student.contact_info or "") if student and company_view else "",
                student_phone=(student.phone or "") if student and company_view else "",
                student_avatar_url=(student.avatar_url or "") if student else "",
                test_task=(app.vacancy.test_task or "") if app.vacancy else "",
                test_questions=questions_of(app.vacancy),
                test_answer=app.test_answer or "",
                test_answers=answers_of(app),
                status=status,
                match_score=result.score,
                match=match_out(result),
                skills_verified=bool(reqs) and result.verified_score == 100.0,
                created_at=app.created_at,
                updated_at=app.updated_at,
                is_overdue=is_overdue(app),
                events=[ApplicationEventOut(kind=e.kind, note=e.note or "", created_at=e.created_at) for e in events],
                next_step=next_step,
                pending_decision_until=app.decision_visible_at if company_view and pending_decision else None,
                company_contact=(company.contact_info or company.phone or "") if company and status == "accepted" and not company_view else "",
            )
        )
    return out


def log_event(db: Session, app: Application, kind: str, note: str = "", at: datetime | None = None) -> None:
    db.add(ApplicationEvent(app_id=app.app_id, kind=kind, note=note, created_at=at or datetime.utcnow()))


# ---- delayed bot messages ----------------------------------------------------------------

def schedule_message(db: Session, user_id: str, text: str, buttons: list | None = None, delay_seconds: int = 0, app_id: int | None = None, kind: str = "") -> OutboxMessage:
    msg = OutboxMessage(
        user_id=user_id, text=text, buttons=json.dumps(buttons or [], ensure_ascii=False), app_id=app_id, kind=kind,
        send_after=datetime.utcnow() + timedelta(seconds=delay_seconds),
    )
    db.add(msg)
    return msg


def cancel_pending_messages(db: Session, app_id: int, kind: str) -> int:
    now = datetime.utcnow()
    rows = db.query(OutboxMessage).filter(OutboxMessage.app_id == app_id, OutboxMessage.kind == kind, OutboxMessage.sent_at.is_(None), OutboxMessage.cancelled_at.is_(None)).all()
    for row in rows:
        row.cancelled_at = now
    return len(rows)


def next_step_text(step: dict, company: str, vacancy: str) -> str:
    lines = [f"🎉 {company} приглашает вас на следующий этап по стажировке «{vacancy}».", ""]
    lines.append(f"Что дальше: {NEXT_STEP_FORMAT.get(step.get('format', ''), 'следующий этап')}")
    if step.get("datetime"):
        lines.append(f"Когда: {step['datetime']}")
    if step.get("place"):
        lines.append(f"Где: {step['place']}")
    contact = " · ".join(filter(None, [step.get("contact_name", ""), step.get("contact_phone", "")]))
    if contact:
        lines.append(f"Контакт: {contact}")
    if step.get("message"):
        lines += ["", step["message"]]
    return "\n".join(lines)


# ---- profile reset -------------------------------------------------------------------------

def reset_student_profile(db: Session, user: User) -> tuple[int, int]:
    """Back to the state right after the first launch: the MAX identity,
    display name and photo stay; everything else goes. Returns
    (removed_skills, removed_applications). Caller commits."""
    removed_skills = db.query(StudentSkill).filter(StudentSkill.student_id == user.user_id).delete(synchronize_session=False)
    apps = db.query(Application).filter(Application.student_id == user.user_id).all()
    for app in apps:
        db.query(OutboxMessage).filter(OutboxMessage.app_id == app.app_id, OutboxMessage.sent_at.is_(None)).delete(synchronize_session=False)
        db.delete(app)  # cascades to the status timeline
    for model in (NotifiedMatch, SearchLog, PassiveNudge, TestAttempt):
        db.query(model).filter(model.student_id == user.user_id).delete(synchronize_session=False)
    user.role = ""
    for field in ("contact_info", "phone", "university", "group", "region", "city", "terms_version", "privacy_version"):
        setattr(user, field, "")
    user.group_id = None
    user.student_directory_opt_in = False
    user.portfolio_public = False
    user.portfolio_token = None
    user.portfolio_show_contact = False
    user.terms_accepted_at = None
    user.privacy_accepted_at = None
    user.created_at = datetime.utcnow()
    return removed_skills, len(apps)


def or_filter_name_group(query, q: str):
    like = f"%{q.strip()}%"
    return query.filter(or_(User.name.ilike(like), User.group.ilike(like)))
