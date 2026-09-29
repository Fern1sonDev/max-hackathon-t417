"""Skill tests authored by the university — alone or together with an
employer. A student who passes a published test of their university gets
the skill verified on the university's behalf (same effect as a curator's
click), so the match index grows immediately."""

import json
from datetime import datetime

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Response
from sqlalchemy.orm import Session, joinedload

from app.auth import get_current_user, require_role
from app.database import get_db
from app.max_client import max_client
from app.models import SkillTest, StudentSkill, TestAttempt, TestQuestion, User
from app.notifications import notify_new_matches_for_student
from app.schemas import (
    CompanyOut,
    ErrorOut,
    SkillTestIn,
    SkillTestOut,
    SkillTestStatusPatch,
    TestAttemptIn,
    TestAttemptOut,
    TestQuestionOut,
)
from app.services import get_or_create_skill, org_owner, same_university

router = APIRouter(prefix="/api", tags=["skill-tests"])


def _load(db: Session, test_id: int) -> SkillTest:
    test = (
        db.query(SkillTest)
        .options(joinedload(SkillTest.questions), joinedload(SkillTest.skill), joinedload(SkillTest.author), joinedload(SkillTest.partner))
        .filter(SkillTest.test_id == test_id)
        .first()
    )
    if not test:
        raise HTTPException(status_code=404, detail="Test not found")
    return test


def _can_manage(db: Session, test: SkillTest, current: dict) -> bool:
    if current["role"] == "curator":
        return same_university(org_owner(db, current).university, test.university)
    if current["role"] == "hr":
        return current["org_id"] == test.partner_company_id
    return False


def _visible(db: Session, test: SkillTest, current: dict) -> bool:
    if current["role"] == "student":
        student = db.get(User, current["user_id"])
        return test.status == "published" and same_university(student.university, test.university)
    return _can_manage(db, test, current)


def _out(db: Session, test: SkillTest, current: dict, with_questions: bool = False) -> SkillTestOut:
    manage = _can_manage(db, test, current)
    out = SkillTestOut(
        test_id=test.test_id,
        title=test.title,
        description=test.description or "",
        skill=test.skill.name,
        university=test.university,
        author_name=test.author.name if test.author else "",
        author_role=test.author.role if test.author else "",
        partner_company_id=test.partner_company_id,
        partner_name=test.partner.name if test.partner else "",
        status=test.status,
        pass_score=test.pass_score,
        max_attempts=test.max_attempts,
        questions_count=len(test.questions),
        created_at=test.created_at,
        can_manage=manage,
    )
    if current["role"] == "student":
        attempts = [a for a in test.attempts if a.student_id == current["user_id"]]
        out.attempts_used = len(attempts)
        out.best_score = max((a.score for a in attempts), default=None)
        out.passed = any(a.passed for a in attempts)
    elif manage:
        out.attempts_total = len(test.attempts)
        out.pass_rate = round(sum(1 for a in test.attempts if a.passed) / len(test.attempts) * 100, 1) if test.attempts else None
    if with_questions:
        out.questions = [
            TestQuestionOut(id=q.id, text=q.text, options=json.loads(q.options), correct_index=q.correct_index if manage else None)
            for q in test.questions
        ]
    return out


@router.get("/companies", response_model=list[CompanyOut], summary="Работодатели на платформе (выбор соавтора теста)")
def list_companies(current=Depends(get_current_user), db: Session = Depends(get_db)):
    require_role(current, "curator", "hr", detail="Only organisations can list companies")
    return [CompanyOut(user_id=u.user_id, name=u.name) for u in db.query(User).filter(User.role == "hr", User.org_owner_id.is_(None)).order_by(User.name)]


@router.get("/tests", response_model=list[SkillTestOut], summary="Тесты навыков: студенту — тесты его вуза, организациям — свои и совместные")
def list_tests(current=Depends(get_current_user), db: Session = Depends(get_db)):
    tests = db.query(SkillTest).options(joinedload(SkillTest.questions), joinedload(SkillTest.skill), joinedload(SkillTest.attempts)).order_by(SkillTest.created_at.desc()).all()
    return [_out(db, t, current) for t in tests if _visible(db, t, current)]


@router.post("/tests", response_model=SkillTestOut, status_code=201, summary="Создать тест (куратор) или предложить тест вузу (работодатель)", responses={403: {"model": ErrorOut}, 422: {"model": ErrorOut}})
def create_test(payload: SkillTestIn, current=Depends(get_current_user), db: Session = Depends(get_db)):
    require_role(current, "curator", "hr", detail="Only curators and employers can create tests")
    for q in payload.questions:
        if q.correct_index >= len(q.options):
            raise HTTPException(status_code=422, detail="correct_index is out of range")
    user = db.get(User, current["user_id"])
    if current["role"] == "curator":
        owner = org_owner(db, current)
        if not owner.university.strip():
            raise HTTPException(status_code=422, detail="Set your university in organization settings first")
        university = owner.university.strip()
        partner = payload.partner_company_id
        if partner:
            company = db.get(User, partner)
            if not company or company.role != "hr":
                raise HTTPException(status_code=422, detail="Partner company not found")
        status = "published" if payload.publish else "draft"
        approved_by = user.user_id if payload.publish else None
    else:
        if not payload.university.strip():
            raise HTTPException(status_code=422, detail="Choose the university the test is proposed to")
        university = payload.university.strip()
        partner = current["org_id"]
        status = "pending"  # a curator of that university publishes it
        approved_by = None

    skill = get_or_create_skill(db, payload.skill)
    test = SkillTest(
        title=payload.title.strip(), description=payload.description.strip(), skill_id=skill.skill_id, university=university,
        author_id=user.user_id, partner_company_id=partner, status=status, approved_by=approved_by,
        pass_score=payload.pass_score, max_attempts=payload.max_attempts,
    )
    db.add(test)
    db.flush()
    for i, q in enumerate(payload.questions):
        db.add(TestQuestion(test_id=test.test_id, position=i, text=q.text.strip(), options=json.dumps(q.options, ensure_ascii=False), correct_index=q.correct_index))
    db.commit()
    return _out(db, _load(db, test.test_id), current, with_questions=True)


@router.get("/tests/{test_id}", response_model=SkillTestOut, summary="Тест с вопросами (правильные ответы видят только авторы)", responses={404: {"model": ErrorOut}})
def get_test(test_id: int, current=Depends(get_current_user), db: Session = Depends(get_db)):
    test = _load(db, test_id)
    if not _visible(db, test, current):
        raise HTTPException(status_code=404, detail="Test not found")
    return _out(db, test, current, with_questions=True)


@router.patch("/tests/{test_id}/status", response_model=SkillTestOut, summary="Куратор: опубликовать или снять с публикации", responses={403: {"model": ErrorOut}, 404: {"model": ErrorOut}})
def set_test_status(test_id: int, payload: SkillTestStatusPatch, current=Depends(get_current_user), db: Session = Depends(get_db)):
    require_role(current, "curator", detail="Only the university's curator publishes tests")
    test = _load(db, test_id)
    if not _can_manage(db, test, current):
        raise HTTPException(status_code=404, detail="Test not found")
    test.status = payload.status
    if payload.status == "published":
        test.approved_by = current["user_id"]
    db.commit()
    return _out(db, _load(db, test_id), current, with_questions=True)


@router.delete("/tests/{test_id}", status_code=204, summary="Удалить тест (куратор вуза или автор)", responses={404: {"model": ErrorOut}})
def delete_test(test_id: int, current=Depends(get_current_user), db: Session = Depends(get_db)):
    test = _load(db, test_id)
    if not (_can_manage(db, test, current) and (current["role"] == "curator" or test.status != "published")):
        raise HTTPException(status_code=404, detail="Test not found")
    db.delete(test)
    db.commit()
    return Response(status_code=204)


@router.post(
    "/tests/{test_id}/attempts",
    response_model=TestAttemptOut,
    summary="Студент: пройти тест; при успехе навык подтверждается от имени вуза",
    responses={404: {"model": ErrorOut}, 409: {"model": ErrorOut}, 422: {"model": ErrorOut}},
)
def attempt_test(test_id: int, payload: TestAttemptIn, background_tasks: BackgroundTasks, current=Depends(get_current_user), db: Session = Depends(get_db)):
    require_role(current, "student", detail="Only students take tests")
    test = _load(db, test_id)
    if not _visible(db, test, current):
        raise HTTPException(status_code=404, detail="Test not found")
    previous = db.query(TestAttempt).filter(TestAttempt.test_id == test_id, TestAttempt.student_id == current["user_id"]).all()
    if any(a.passed for a in previous):
        raise HTTPException(status_code=409, detail="The test is already passed")
    if len(previous) >= test.max_attempts:
        raise HTTPException(status_code=409, detail="No attempts left")
    if len(payload.answers) != len(test.questions):
        raise HTTPException(status_code=422, detail="Answer every question")

    correct = [answer == q.correct_index for answer, q in zip(payload.answers, test.questions)]
    score = round(sum(correct) / len(correct) * 100)
    passed = score >= test.pass_score
    db.add(TestAttempt(test_id=test_id, student_id=current["user_id"], score=score, passed=passed))

    verified_now = False
    if passed:
        link = db.query(StudentSkill).filter(StudentSkill.student_id == current["user_id"], StudentSkill.skill_id == test.skill_id).first()
        if not link:
            link = StudentSkill(student_id=current["user_id"], skill_id=test.skill_id)
            db.add(link)
        if not link.is_verified:
            link.is_verified = True
            link.status = "verified"
            link.comment = f"Тест «{test.title}» сдан на {score}%"
            link.verified_by = test.approved_by or test.author_id
            link.verified_at = datetime.utcnow()
            verified_now = True
    db.commit()

    if verified_now:
        partner = f" совместно с {test.partner.name}" if test.partner else ""
        background_tasks.add_task(
            max_client.send_message,
            current["user_id"],
            f"Тест «{test.title}» пройден на {score}%. Навык «{test.skill.name}» подтверждён вузом{partner} — индекс соответствия пересчитан.",
            [[{"text": "Подходящие стажировки", "url": max_client.miniapp_link()}]],
        )
        background_tasks.add_task(notify_new_matches_for_student, current["user_id"])
    return TestAttemptOut(
        score=score, passed=passed, correct=correct, attempts_left=max(0, test.max_attempts - len(previous) - 1),
        skill=test.skill.name, skill_verified=passed,
    )
