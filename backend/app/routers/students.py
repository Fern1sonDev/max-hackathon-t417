"""University skill review (batched, with comments and three outcomes),
employer talent directory, public digital certificates."""

from datetime import datetime

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth import certificate_token, get_current_user, require_role, verify_certificate_token
from app.config import settings
from app.database import get_db
from app.max_client import max_client
from app.models import StudentGroup, StudentSkill, User
from app.notifications import notify_new_matches_for_student
from app.schemas import (
    CertificateLinkOut,
    CertificateOut,
    ErrorOut,
    SkillReviewIn,
    SkillReviewOut,
    SkillVerifyIn,
    StudentEditIn,
    StudentOut,
    StudentSkillOut,
)
from app.services import ensure_curator_owns, or_filter_name_group, org_owner, schedule_message, skill_out, student_out, students_out, visible_student_query

router = APIRouter(prefix="/api", tags=["students"])

DECISION_WORD = {"verified": "подтверждён", "employer_review": "на усмотрение работодателя", "rejected": "не подтверждён", "claimed": "возвращён на проверку"}


@router.get("/students", response_model=list[StudentOut], summary="Куратор: студенты вуза (фильтры: группа, поиск, требует проверки)")
def list_students(q: str | None = None, group_id: int | None = None, to_review: bool = False, current=Depends(get_current_user), db: Session = Depends(get_db)):
    require_role(current, "curator", detail="Only curators can view the student list")
    query = visible_student_query(db, current)
    if q and q.strip():
        query = or_filter_name_group(query, q)
    if group_id:
        query = query.filter(User.group_id == group_id)
    out = students_out(db, query.order_by(User.name).all(), include_phone=True)
    if to_review:
        out = [s for s in out if any(k.status == "claimed" for k in s.skills)]
    return out


@router.get("/students/directory", response_model=list[StudentOut], summary="Работодатель: кандидаты и открытые профили")
def student_directory(q: str | None = None, region: str | None = None, city: str | None = None, university: str | None = None, current=Depends(get_current_user), db: Session = Depends(get_db)):
    require_role(current, "hr", detail="Only employers can browse the student directory")
    query = visible_student_query(db, current)
    if q and q.strip():
        query = or_filter_name_group(query, q)
    if region:
        query = query.filter(User.region == region.strip())
    if city:
        query = query.filter(User.city == city.strip())
    if university:
        query = query.filter(User.university.ilike(f"%{university.strip()}%"))
    return students_out(db, query.order_by(User.name).all())


@router.patch("/students/{student_id}", response_model=StudentOut, summary="Куратор: перевести студента в группу", responses={404: {"model": ErrorOut}})
def edit_student(student_id: str, payload: StudentEditIn, current=Depends(get_current_user), db: Session = Depends(get_db)):
    require_role(current, "curator", detail="Only curators can edit student records")
    student = ensure_curator_owns(db, current, student_id)
    if payload.group_id is not None:
        group = db.get(StudentGroup, payload.group_id)
        if not group or group.org_id != current["org_id"]:
            raise HTTPException(status_code=404, detail="Group not found")
        student.group_id, student.group, student.region, student.city = group.group_id, group.name, group.region, group.city
    else:
        for field in ("group", "region", "city"):
            value = getattr(payload, field)
            if value is not None:
                setattr(student, field, value.strip())
    db.commit()
    db.refresh(student)
    return student_out(db, student, include_phone=True)


@router.put(
    "/students/{student_id}/skills",
    response_model=SkillReviewOut,
    summary="Куратор: пакетная проверка навыков студента — одно сводное уведомление",
    responses={404: {"model": ErrorOut}},
)
def review_skills(student_id: str, payload: SkillReviewIn, background_tasks: BackgroundTasks, current=Depends(get_current_user), db: Session = Depends(get_db)):
    """Decisions: verified (optionally with a comment such as «участие в
    хакатоне»), employer_review («на усмотрение работодателя»), rejected,
    claimed (back to review). The student gets one summary message."""
    require_role(current, "curator", detail="Only curators can review skills")
    student = ensure_curator_owns(db, current, student_id)
    links = {link.skill_id: link for link in db.query(StudentSkill).filter(StudentSkill.student_id == student_id)}
    now = datetime.utcnow()
    changes: list[tuple[str, str, str]] = []
    became_verified = False
    for decision in payload.decisions:
        link = links.get(decision.skill_id)
        if not link:
            raise HTTPException(status_code=404, detail="Student does not claim this skill")
        current_status = "verified" if link.is_verified else (link.status or "claimed")
        comment = decision.comment.strip()
        if current_status == decision.status and (link.comment or "") == comment:
            continue
        became_verified |= decision.status == "verified" and current_status != "verified"
        link.status = decision.status
        link.is_verified = decision.status == "verified"
        link.comment = comment
        link.verified_by = current["user_id"] if decision.status != "claimed" else None
        link.verified_at = now if decision.status != "claimed" else None
        changes.append((link.skill.name, decision.status, comment))

    notified = False
    if changes:
        university = org_owner(db, current).university
        lines = [f"Вуз проверил ваши навыки ({university}):"]
        for name, status, comment in changes:
            lines.append(f"• {name} — {DECISION_WORD[status]}" + (f" ({comment})" if comment else ""))
        lines.append("\nИндекс соответствия по стажировкам уже пересчитан.")
        schedule_message(db, student_id, "\n".join(lines), [[{"text": "Открыть ПрактикаПлюс", "url": max_client.miniapp_link("profile")}]], kind="review")
        notified = True
    db.commit()
    if became_verified:
        background_tasks.add_task(notify_new_matches_for_student, student_id)
    db.refresh(student)
    return SkillReviewOut(changed=len(changes), notified=notified, student=student_out(db, student, include_phone=True))


@router.patch(
    "/students/{student_id}/skills/{skill_id}",
    response_model=StudentSkillOut,
    summary="Куратор: подтвердить одиночный навык без уведомления (для пакетной проверки используйте PUT …/skills)",
    responses={404: {"model": ErrorOut}},
)
def verify_skill(student_id: str, skill_id: int, payload: SkillVerifyIn, current=Depends(get_current_user), db: Session = Depends(get_db)):
    require_role(current, "curator", detail="Only curators can verify skills")
    ensure_curator_owns(db, current, student_id)
    link = db.query(StudentSkill).filter(StudentSkill.student_id == student_id, StudentSkill.skill_id == skill_id).first()
    if not link:
        raise HTTPException(status_code=404, detail="Student does not claim this skill")
    link.is_verified = payload.is_verified
    link.status = "verified" if payload.is_verified else "claimed"
    link.verified_by = current["user_id"] if payload.is_verified else None
    link.verified_at = datetime.utcnow() if payload.is_verified else None
    db.commit()
    return skill_out(link)


@router.get("/students/{student_id}/skills/{skill_id}/certificate-link", response_model=CertificateLinkOut, summary="Куратор: ссылка на цифровой сертификат навыка", responses={404: {"model": ErrorOut}})
def certificate_link(student_id: str, skill_id: int, current=Depends(get_current_user), db: Session = Depends(get_db)):
    require_role(current, "curator", detail="Only curators can share a certificate link")
    ensure_curator_owns(db, current, student_id)
    if not db.query(StudentSkill).filter(StudentSkill.student_id == student_id, StudentSkill.skill_id == skill_id, StudentSkill.is_verified.is_(True)).first():
        raise HTTPException(status_code=404, detail="Skill is not verified")
    return CertificateLinkOut(url=f"{settings.lk_public_url}/certificate/{student_id}/{skill_id}/{certificate_token(student_id, skill_id)}")


@router.get("/me/skills/{skill_id}/certificate-link", response_model=CertificateLinkOut, summary="Студент: ссылка на сертификат своего навыка", responses={404: {"model": ErrorOut}})
def my_certificate_link(skill_id: int, current=Depends(get_current_user), db: Session = Depends(get_db)):
    require_role(current, "student", detail="Only students have certificates")
    if not db.query(StudentSkill).filter(StudentSkill.student_id == current["user_id"], StudentSkill.skill_id == skill_id, StudentSkill.is_verified.is_(True)).first():
        raise HTTPException(status_code=404, detail="Skill is not verified")
    return CertificateLinkOut(url=f"{settings.lk_public_url}/certificate/{current['user_id']}/{skill_id}/{certificate_token(current['user_id'], skill_id)}")


@router.get("/certificates/{student_id}/{skill_id}/{token}", response_model=CertificateOut, tags=["public"], summary="Публичная проверка сертификата (без авторизации)", responses={404: {"model": ErrorOut}})
def get_certificate(student_id: str, skill_id: int, token: str, db: Session = Depends(get_db)):
    if not verify_certificate_token(student_id, skill_id, token):
        raise HTTPException(status_code=404, detail="Certificate not found")
    link = db.query(StudentSkill).filter(StudentSkill.student_id == student_id, StudentSkill.skill_id == skill_id, StudentSkill.is_verified.is_(True)).first()
    if not link or not link.verified_at:
        raise HTTPException(status_code=404, detail="Certificate not found")
    return CertificateOut(
        student_name=link.student.name if link.student else "", university=link.student.university if link.student else "",
        skill=link.skill.name, verified_by_name=link.verifier.name if link.verifier else "", verified_at=link.verified_at, comment=link.comment or "",
    )
