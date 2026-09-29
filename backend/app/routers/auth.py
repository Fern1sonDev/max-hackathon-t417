"""Sign-in for all roles.

Students: MAX launch data (HMAC-verified) or, with SANDBOX_LOGIN, a browser
sandbox id. Organisations: email + password; registration creates the
organisation workspace whose owner can invite colleagues (routers/team.py).
"""

import threading
import time
from collections import defaultdict, deque
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth import create_token, hash_password, is_sandbox_id, parse_max_init_data, verify_password
from app.config import settings
from app.database import get_db
from app.geo import clean_place
from app.models import User
from app.schemas import AuthRequest, AuthResponse, ErrorOut, LoginIn, RegisterIn
from app.services import safe_avatar_url

router = APIRouter(prefix="/api", tags=["auth"])

_attempts: dict[str, deque] = defaultdict(deque)
_attempts_lock = threading.Lock()


def _check_rate_limit(key: str) -> None:
    now = time.monotonic()
    with _attempts_lock:
        window = _attempts[key]
        while window and now - window[0] > settings.login_window_seconds:
            window.popleft()
        if len(window) >= settings.login_max_attempts:
            raise HTTPException(status_code=429, detail="Too many login attempts, try again in a few minutes")
        window.append(now)


def _reset_rate_limit(key: str) -> None:
    with _attempts_lock:
        _attempts.pop(key, None)


@router.post("/auth", response_model=AuthResponse, summary="Вход студента из мини-приложения MAX", responses={401: {"model": ErrorOut}})
def auth(payload: AuthRequest, db: Session = Depends(get_db)):
    start_param = None
    avatar = ""
    if payload.init_data:
        parsed = parse_max_init_data(payload.init_data)
        if not parsed:
            raise HTTPException(status_code=401, detail="Invalid MAX launch signature")
        max_user = parsed.get("user") or {}
        if not max_user.get("id"):
            raise HTTPException(status_code=401, detail="Invalid MAX launch signature")
        user_id = str(max_user["id"])
        name = " ".join(filter(None, [max_user.get("first_name"), max_user.get("last_name")])) or "Пользователь"
        start_param = parsed.get("start_param")
        avatar = safe_avatar_url(max_user.get("photo_url"))
    elif settings.sandbox_login and payload.user_id and is_sandbox_id(payload.user_id):
        user_id, name = payload.user_id, (payload.name or "Тестовый студент").strip()[:120]
    else:
        raise HTTPException(status_code=401, detail="Missing MAX launch data")

    user = db.get(User, user_id)
    if not user:
        try:
            db.add(User(user_id=user_id, name=name, role="", avatar_url=avatar))
            db.commit()
        except IntegrityError:
            db.rollback()  # two launches of the same new user raced — the other request created the row
        user = db.get(User, user_id)
    if user.role and user.role != "student":
        raise HTTPException(status_code=401, detail="Use the organisation cabinet to sign in")
    if avatar and user.avatar_url != avatar:
        user.avatar_url = avatar  # the MAX profile photo follows the user
        db.commit()
    return AuthResponse(token=create_token(user.user_id), role=user.role or None, profile_complete=bool(user.role and user.name), start_param=start_param)


@router.post(
    "/register",
    response_model=AuthResponse,
    summary="Регистрация организации: компания (владелец — HR-директор) или вуз (администратор)",
    responses={409: {"model": ErrorOut}, 422: {"model": ErrorOut}},
)
def register(payload: RegisterIn, db: Session = Depends(get_db)):
    if not payload.accept_terms or not payload.accept_privacy:
        raise HTTPException(status_code=422, detail="Accept the terms and personal data consent to register")
    email = payload.email.lower()
    if db.query(User).filter(func.lower(User.email) == email).first():
        raise HTTPException(status_code=409, detail="Email already registered")
    if payload.role == "curator" and not payload.university.strip():
        raise HTTPException(status_code=422, detail="University is required for a curator account")
    region, city = clean_place(payload.region, payload.city)

    now = datetime.utcnow()
    user = User(
        user_id=f"{payload.role}-{email}",
        role=payload.role,
        name=payload.name.strip(),
        person_name=payload.person_name.strip(),
        position=payload.position.strip() or ("HR-директор" if payload.role == "hr" else "Администратор вуза"),
        email=email,
        phone=payload.phone.strip(),
        password_hash=hash_password(payload.password),
        university=payload.university.strip() if payload.role == "curator" else "",
        region=region,
        city=city,
        terms_accepted_at=now,
        terms_version=settings.terms_version,
        privacy_accepted_at=now,
        privacy_version=settings.privacy_version,
    )
    db.add(user)
    db.commit()
    return AuthResponse(token=create_token(user.user_id), role=user.role, profile_complete=True)


@router.post("/login", response_model=AuthResponse, summary="Вход сотрудника организации", responses={401: {"model": ErrorOut}, 429: {"model": ErrorOut}})
def login(payload: LoginIn, request: Request, db: Session = Depends(get_db)):
    email = payload.email.lower()
    client_ip = request.headers.get("x-real-ip") or (request.client.host if request.client else "-")
    key = f"{client_ip}|{email}"
    _check_rate_limit(key)
    user = db.query(User).filter(func.lower(User.email) == email).first()
    if not user or not user.password_hash or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    _reset_rate_limit(key)
    return AuthResponse(token=create_token(user.user_id), role=user.role, profile_complete=True)
