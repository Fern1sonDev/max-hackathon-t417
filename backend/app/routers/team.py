"""Organisation workspaces: the owner (HR director / university admin)
invites recruiters or curators by link; they set a password and work on the
same vacancies, candidates, groups and students."""

import secrets
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.auth import create_token, get_current_user, hash_password, require_role
from app.config import settings
from app.database import get_db
from app.models import OrgInvite, User
from app.schemas import AuthResponse, ErrorOut, InviteAcceptIn, InvitePublicOut, TeamInviteIn, TeamInviteOut, TeamMemberOut, TeamOut
from app.services import org_owner

router = APIRouter(prefix="/api", tags=["team"])

INVITE_DAYS = 7


def org_name(owner: User) -> str:
    return owner.university if owner.role == "curator" and owner.university else owner.name


def _invite_out(invite: OrgInvite) -> TeamInviteOut:
    return TeamInviteOut(
        token=invite.token, name=invite.name or "", email=invite.email, position=invite.position or "",
        url=f"{settings.lk_public_url}/invite/{invite.token}", expires_at=invite.expires_at,
    )


def _require_owner(current: dict) -> None:
    require_role(current, "hr", "curator", detail="Teams are available to organisations")
    if not current["is_owner"]:
        raise HTTPException(status_code=403, detail="Only the organisation owner manages the team")


@router.get("/team", response_model=TeamOut, summary="Сотрудники организации и активные приглашения")
def get_team(current=Depends(get_current_user), db: Session = Depends(get_db)):
    require_role(current, "hr", "curator", detail="Teams are available to organisations")
    owner = org_owner(db, current)
    members = [owner] + db.query(User).filter(User.org_owner_id == owner.user_id).order_by(User.created_at).all()
    invites = []
    if current["is_owner"]:
        invites = db.query(OrgInvite).filter(OrgInvite.org_owner_id == owner.user_id, OrgInvite.used_at.is_(None), OrgInvite.expires_at > datetime.utcnow()).all()
    return TeamOut(
        org_name=org_name(owner),
        role=owner.role,
        members=[
            TeamMemberOut(
                user_id=m.user_id, name=(m.person_name or m.name) if m.user_id == owner.user_id and owner.role == "hr" else m.name,
                email=m.email or "", position=m.position or "", is_owner=m.user_id == owner.user_id, created_at=m.created_at,
            )
            for m in members
        ],
        invites=[_invite_out(i) for i in invites],
    )


@router.post("/team/invites", response_model=TeamInviteOut, status_code=201, summary="Пригласить сотрудника (владелец)", responses={403: {"model": ErrorOut}, 409: {"model": ErrorOut}})
def create_invite(payload: TeamInviteIn, current=Depends(get_current_user), db: Session = Depends(get_db)):
    _require_owner(current)
    email = payload.email.lower()
    if db.query(User).filter(func.lower(User.email) == email).first():
        raise HTTPException(status_code=409, detail="Email already registered")
    owner = org_owner(db, current)
    invite = OrgInvite(
        token=secrets.token_urlsafe(18), org_owner_id=owner.user_id, role=owner.role, name=payload.name.strip(), email=email,
        position=payload.position.strip() or ("Рекрутер" if owner.role == "hr" else "Куратор практики"),
        expires_at=datetime.utcnow() + timedelta(days=INVITE_DAYS),
    )
    db.add(invite)
    db.commit()
    return _invite_out(invite)


@router.delete("/team/invites/{token}", status_code=204, summary="Отозвать приглашение")
def revoke_invite(token: str, current=Depends(get_current_user), db: Session = Depends(get_db)):
    _require_owner(current)
    db.query(OrgInvite).filter(OrgInvite.token == token, OrgInvite.org_owner_id == current["org_id"]).delete()
    db.commit()
    return Response(status_code=204)


@router.delete("/team/members/{user_id}", status_code=204, summary="Отключить сотрудника (владелец)", responses={404: {"model": ErrorOut}})
def remove_member(user_id: str, current=Depends(get_current_user), db: Session = Depends(get_db)):
    _require_owner(current)
    member = db.get(User, user_id)
    if not member or member.org_owner_id != current["org_id"]:
        raise HTTPException(status_code=404, detail="Member not found")
    # Access is revoked; authored data (vacancies, reviews) stays with the organisation.
    member.password_hash = None
    member.email = None
    member.org_owner_id = f"removed:{current['org_id']}"
    db.commit()
    return Response(status_code=204)


@router.get("/invites/{token}", response_model=InvitePublicOut, tags=["public"], summary="Данные приглашения (без авторизации)", responses={404: {"model": ErrorOut}})
def get_invite(token: str, db: Session = Depends(get_db)):
    invite = db.get(OrgInvite, token)
    if not invite or invite.used_at or invite.expires_at < datetime.utcnow():
        raise HTTPException(status_code=404, detail="Invite not found or expired")
    owner = db.get(User, invite.org_owner_id)
    return InvitePublicOut(org_name=org_name(owner), role=invite.role, name=invite.name or "", email=invite.email, position=invite.position or "")


@router.post("/invites/{token}/accept", response_model=AuthResponse, tags=["public"], summary="Принять приглашение и задать пароль", responses={404: {"model": ErrorOut}, 422: {"model": ErrorOut}})
def accept_invite(token: str, payload: InviteAcceptIn, db: Session = Depends(get_db)):
    invite = db.get(OrgInvite, token)
    if not invite or invite.used_at or invite.expires_at < datetime.utcnow():
        raise HTTPException(status_code=404, detail="Invite not found or expired")
    if not payload.accept_terms or not payload.accept_privacy:
        raise HTTPException(status_code=422, detail="Accept the terms and personal data consent to register")
    if db.query(User).filter(func.lower(User.email) == invite.email).first():
        raise HTTPException(status_code=409, detail="Email already registered")
    owner = db.get(User, invite.org_owner_id)
    now = datetime.utcnow()
    member = User(
        user_id=f"{invite.role}-{invite.email}", role=invite.role, name=payload.name.strip(), email=invite.email,
        password_hash=hash_password(payload.password), position=invite.position or "", org_owner_id=owner.user_id,
        university=owner.university if owner.role == "curator" else "", region=owner.region or "", city=owner.city or "",
        terms_accepted_at=now, terms_version=settings.terms_version, privacy_accepted_at=now, privacy_version=settings.privacy_version,
    )
    db.add(member)
    invite.used_at = now
    db.commit()
    return AuthResponse(token=create_token(member.user_id), role=member.role, profile_complete=True)
