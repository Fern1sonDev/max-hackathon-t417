"""JWT issuance/verification and the MAX launch-data check point.

Auth flow for students:
1. The PWA mini app loads inside MAX with the MAX Bridge script
   (st.max.ru/js/max-web-app.js) present, which exposes window.WebApp.initData
   — a query-string of launch params signed by MAX with the bot token.
2. The PWA POSTs that raw string to /api/auth as `init_data`.
3. parse_max_init_data() verifies the HMAC-SHA256 signature (algorithm per
   dev.max.ru/docs/webapps/validation, same construction as Telegram Mini
   Apps: secret_key = HMAC_SHA256(key="WebAppData", msg=bot_token), then
   hash = HMAC_SHA256(key=secret_key, msg=sorted "k=v" lines joined by \n).
   Only a verified `user.id` is ever trusted as a student's identity.
4. Outside MAX (SANDBOX_LOGIN=true), the PWA falls back to a plain
   user_id/name payload so the product can be tested in a browser without a
   live MAX session. Only sandbox ids (`dev-…`, `demo-…`) are accepted there
   — never a numeric MAX id — see is_sandbox_id().
5. On success we issue our own short-lived JWT that every /api/* call uses.
"""

import datetime
import hashlib
import hmac
import json
import os
import re
import time
from urllib.parse import parse_qsl

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import User

_INIT_DATA_MAX_AGE_SECONDS = 60 * 60

security = HTTPBearer()

_PBKDF2_ITERATIONS = 260_000


def hash_password(password: str) -> str:
    """PBKDF2-HMAC-SHA256, stdlib only (no extra native-build dependency in
    the image). Good enough for an MVP's own login — not meant to replace a
    real SSO/identity provider if this goes further than the hackathon."""
    salt = os.urandom(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, _PBKDF2_ITERATIONS)
    return f"{salt.hex()}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        salt_hex, digest_hex = stored.split("$", 1)
    except ValueError:
        return False
    salt = bytes.fromhex(salt_hex)
    expected = bytes.fromhex(digest_hex)
    actual = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, _PBKDF2_ITERATIONS)
    return hmac.compare_digest(actual, expected)


def parse_max_init_data(init_data: str) -> dict | None:
    """Validates window.WebApp.initData and returns the decoded payload
    (including the `user` dict) on success, or None if the signature is
    missing/invalid/stale. Never trust `init_data` without going through
    this check — it's the only thing standing between a request and being
    able to impersonate any MAX user id."""
    if not settings.max_bot_token:
        return None

    pairs = parse_qsl(init_data, keep_blank_values=True)
    data = dict(pairs)
    received_hash = data.pop("hash", None)
    if not received_hash:
        return None

    data_check_string = "\n".join(f"{k}={v}" for k, v in sorted(data.items()))
    secret_key = hmac.new(b"WebAppData", settings.max_bot_token.encode(), hashlib.sha256).digest()
    computed_hash = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(computed_hash, received_hash):
        return None

    auth_date = data.get("auth_date")
    if auth_date is None:
        return None
    age_seconds = time.time() - int(auth_date)
    if age_seconds < -60 or age_seconds > _INIT_DATA_MAX_AGE_SECONDS:
        return None

    user_raw = data.get("user")
    if not user_raw:
        return None
    try:
        data["user"] = json.loads(user_raw)
    except ValueError:
        return None

    return data


def certificate_token(student_id: str, skill_id: int) -> str:
    """Short HMAC token so the public certificate URL
    (/api/certificates/{student_id}/{skill_id}/{token}) can't be walked by
    guessing sequential ids — it's only ever handed out via the authenticated
    certificate-link endpoint."""
    digest = hmac.new(settings.jwt_secret.encode(), f"{student_id}:{skill_id}".encode(), hashlib.sha256).hexdigest()
    return digest[:16]


def verify_certificate_token(student_id: str, skill_id: int, token: str) -> bool:
    return hmac.compare_digest(certificate_token(student_id, skill_id), token)


def create_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=settings.jwt_ttl_hours),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")


_SANDBOX_ID = re.compile(r"^(dev|demo)-[A-Za-z0-9_-]{1,48}$")

# Requests allowed before the current terms/consent are accepted: reading and
# saving one's own profile (that is where consent is given), public skill
# catalogue for onboarding, and the student's own profile reset.
_CONSENT_EXEMPT = {("GET", "/api/me"), ("PUT", "/api/me"), ("POST", "/api/me/reset"), ("GET", "/api/skills"), ("GET", "/api/universities"), ("GET", "/api/geo")}


def is_sandbox_id(user_id: str) -> bool:
    """Browser-only test identities. Real MAX ids are numeric, so they never
    match — the sandbox login can't be used to take over a real account."""
    return bool(_SANDBOX_ID.match(user_id or ""))


def consent_current(user: User) -> bool:
    return bool(
        user.terms_accepted_at and user.privacy_accepted_at
        and user.terms_version == settings.terms_version
        and user.privacy_version == settings.privacy_version
    )


def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> dict:
    """Identity comes from the JWT; role is read fresh from the DB on every
    request instead of being baked into the token. A token is issued once
    at /api/auth, before the user has picked a role via PUT /api/me — if
    role were embedded in the token, every request after onboarding would
    still see the stale pre-onboarding role until the token was reissued.
    """
    payload = decode_token(credentials.credentials)
    user = db.get(User, payload["sub"])
    if not user or (user.org_owner_id or "").startswith("removed:"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    if not consent_current(user) and (request.method, request.url.path) not in _CONSENT_EXEMPT:
        raise HTTPException(status_code=428, detail="Current terms and personal data consent are required")
    # org_id: the organisation workspace (owner account) staff act on behalf of.
    return {
        "user_id": user.user_id,
        "role": user.role or None,
        "org_id": user.org_owner_id or user.user_id,
        "is_owner": not user.org_owner_id,
    }


def require_role(current: dict, *roles: str, detail: str = "Forbidden for this role") -> None:
    if current["role"] not in roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=detail)
