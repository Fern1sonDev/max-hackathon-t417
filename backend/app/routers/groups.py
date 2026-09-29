"""Academic groups of a university. Each group has its own invite link and QR
code (`startapp=g_<code>`): a student who opens it gets university, group,
region and city filled in and locked."""

import secrets
import string

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from app.auth import get_current_user, require_role
from app.config import settings
from app.database import get_db
from app.geo import clean_place
from app.models import StudentGroup, User
from app.schemas import ErrorOut, GroupIn, GroupInvitePublicOut, GroupOut, StudentOut
from app.services import org_owner, students_out, visible_student_query

router = APIRouter(prefix="/api", tags=["groups"])

_ALPHABET = string.ascii_letters + string.digits


def _new_code(db: Session) -> str:
    while True:
        code = "".join(secrets.choice(_ALPHABET) for _ in range(10))
        if not db.query(StudentGroup).filter(StudentGroup.invite_code == code).first():
            return code


def invite_url(code: str) -> str:
    return f"https://max.ru/{settings.max_bot_username}?startapp=g_{code}"


def _group_out(db: Session, group: StudentGroup, students: list[StudentOut] | None = None) -> GroupOut:
    if students is None:
        members = db.query(User).filter(User.role == "student", User.group_id == group.group_id).all()
        students = students_out(db, members)
    return GroupOut(
        group_id=group.group_id, name=group.name, course=group.course or 0, specialty=group.specialty or "", university=group.university,
        region=group.region or "", city=group.city or "", curator_id=group.curator_id, curator_name=group.curator.name if group.curator else "",
        invite_code=group.invite_code, invite_url=invite_url(group.invite_code), students_count=len(students),
        to_review=sum(1 for s in students if any(k.status == "claimed" for k in s.skills)),
        with_applications=sum(1 for s in students if s.applications), accepted=sum(1 for s in students if s.accepted),
        passive=sum(1 for s in students if s.is_passive),
    )


def _load(db: Session, current: dict, group_id: int) -> StudentGroup:
    group = db.get(StudentGroup, group_id)
    if not group or group.org_id != current["org_id"]:
        raise HTTPException(status_code=404, detail="Group not found")
    return group


@router.get("/groups", response_model=list[GroupOut], summary="Куратор: группы вуза")
def list_groups(current=Depends(get_current_user), db: Session = Depends(get_db)):
    require_role(current, "curator", detail="Groups are managed by the university")
    groups = db.query(StudentGroup).filter(StudentGroup.org_id == current["org_id"]).order_by(StudentGroup.name).all()
    return [_group_out(db, g) for g in groups]


@router.post("/groups", response_model=GroupOut, status_code=201, summary="Куратор: создать группу с QR-кодом и ссылкой-приглашением", responses={422: {"model": ErrorOut}})
def create_group(payload: GroupIn, current=Depends(get_current_user), db: Session = Depends(get_db)):
    require_role(current, "curator", detail="Groups are managed by the university")
    owner = org_owner(db, current)
    if not owner.university.strip():
        raise HTTPException(status_code=422, detail="Set your university in organization settings first")
    region, city = clean_place(payload.region or owner.region, payload.city or owner.city)
    curator_id = payload.curator_id or current["user_id"]
    curator = db.get(User, curator_id)
    if not curator or (curator.user_id != owner.user_id and curator.org_owner_id != owner.user_id):
        raise HTTPException(status_code=422, detail="Curator must be a member of your university")
    group = StudentGroup(
        org_id=owner.user_id, university=owner.university.strip(), name=payload.name.strip(), course=payload.course,
        specialty=payload.specialty.strip(), region=region, city=city, curator_id=curator_id, invite_code=_new_code(db),
    )
    db.add(group)
    db.commit()
    return _group_out(db, group, [])


@router.get("/groups/{group_id}", response_model=GroupOut, summary="Куратор: карточка группы")
def get_group(group_id: int, current=Depends(get_current_user), db: Session = Depends(get_db)):
    require_role(current, "curator", detail="Groups are managed by the university")
    return _group_out(db, _load(db, current, group_id))


@router.get("/groups/{group_id}/students", response_model=list[StudentOut], summary="Куратор: студенты группы")
def group_students(group_id: int, current=Depends(get_current_user), db: Session = Depends(get_db)):
    require_role(current, "curator", detail="Groups are managed by the university")
    group = _load(db, current, group_id)
    students = visible_student_query(db, current).filter(User.group_id == group.group_id).order_by(User.name).all()
    return students_out(db, students, include_phone=True)


@router.patch("/groups/{group_id}", response_model=GroupOut, summary="Куратор: изменить группу", responses={404: {"model": ErrorOut}})
def update_group(group_id: int, payload: GroupIn, current=Depends(get_current_user), db: Session = Depends(get_db)):
    require_role(current, "curator", detail="Groups are managed by the university")
    group = _load(db, current, group_id)
    group.region, group.city = clean_place(payload.region, payload.city, (group.region, group.city))
    group.name, group.course, group.specialty = payload.name.strip(), payload.course, payload.specialty.strip()
    if payload.curator_id:
        group.curator_id = payload.curator_id
    for student in db.query(User).filter(User.group_id == group.group_id):
        student.group, student.region, student.city = group.name, group.region, group.city
    db.commit()
    return _group_out(db, group)


@router.post("/groups/{group_id}/rotate-invite", response_model=GroupOut, summary="Куратор: перевыпустить ссылку-приглашение (старая перестанет работать)")
def rotate_invite(group_id: int, current=Depends(get_current_user), db: Session = Depends(get_db)):
    require_role(current, "curator", detail="Groups are managed by the university")
    group = _load(db, current, group_id)
    group.invite_code = _new_code(db)
    db.commit()
    return _group_out(db, group)


@router.delete("/groups/{group_id}", status_code=204, summary="Куратор: удалить пустую группу", responses={409: {"model": ErrorOut}})
def delete_group(group_id: int, current=Depends(get_current_user), db: Session = Depends(get_db)):
    require_role(current, "curator", detail="Groups are managed by the university")
    group = _load(db, current, group_id)
    if db.query(User).filter(User.group_id == group.group_id).first():
        raise HTTPException(status_code=409, detail="Move the students to another group first")
    db.delete(group)
    db.commit()
    return Response(status_code=204)


@router.get("/public/groups/{code}", response_model=GroupInvitePublicOut, tags=["public"], summary="Данные приглашения группы для онбординга", responses={404: {"model": ErrorOut}})
def group_invite(code: str, db: Session = Depends(get_db)):
    group = db.query(StudentGroup).filter(StudentGroup.invite_code == code).first()
    if not group:
        raise HTTPException(status_code=404, detail="Invite link is not valid")
    return GroupInvitePublicOut(university=group.university, group=group.name, region=group.region or "", city=group.city or "", course=group.course or 0, specialty=group.specialty or "")
