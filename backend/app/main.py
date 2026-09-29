import asyncio
import contextlib
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import inspect, text

from app.config import settings
from app.database import Base, SessionLocal, engine
from app.max_client import max_client
from app import models  # noqa: F401  (register all tables with the metadata)
from app.routers import analytics, applications, auth, groups, integrations, profile, skill_tests, students, team, vacancies, webhook
from app.scheduled_jobs import deliver_outbox, run_scheduled_pass
from app.schemas import HealthOut
from app.seed import ensure_demo_data, ensure_starter_skills

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("app")

# Additive, idempotent schema migration: create_all() creates new tables but
# never adds columns to an existing deployment. Safe for PostgreSQL and SQLite.
_COLUMN_ADDITIONS = {
    "vacancies": {"test_task": "TEXT NOT NULL DEFAULT ''", "test_questions": "TEXT NOT NULL DEFAULT ''"},
    "applications": {
        "test_answer": "TEXT NOT NULL DEFAULT ''",
        "test_answers": "TEXT NOT NULL DEFAULT ''",
        "previous_status": "VARCHAR(20) NOT NULL DEFAULT ''",
        "decision_visible_at": "TIMESTAMP NULL",
        "next_step": "TEXT NOT NULL DEFAULT ''",
    },
    "student_skills": {"status": "VARCHAR(20) NOT NULL DEFAULT 'claimed'", "comment": "VARCHAR(300) NOT NULL DEFAULT ''"},
    "users": {
        "terms_accepted_at": "TIMESTAMP NULL",
        "terms_version": "VARCHAR(32) NOT NULL DEFAULT ''",
        "privacy_accepted_at": "TIMESTAMP NULL",
        "privacy_version": "VARCHAR(32) NOT NULL DEFAULT ''",
        "student_directory_opt_in": "BOOLEAN NOT NULL DEFAULT FALSE",
        "avatar_url": "VARCHAR(500) NOT NULL DEFAULT ''",
        "phone": "VARCHAR(40) NOT NULL DEFAULT ''",
        "position": "VARCHAR(80) NOT NULL DEFAULT ''",
        "person_name": "VARCHAR(120) NOT NULL DEFAULT ''",
        "org_owner_id": "VARCHAR NULL",
        "group_id": "INTEGER NULL",
        "portfolio_token": "VARCHAR(40) NULL",
        "portfolio_public": "BOOLEAN NOT NULL DEFAULT FALSE",
        "portfolio_show_contact": "BOOLEAN NOT NULL DEFAULT FALSE",
    },
    "vacancy_required_skills": {"is_core": "BOOLEAN NOT NULL DEFAULT TRUE"},
}


def _check_production_config() -> None:
    if settings.env != "prod":
        return
    missing = []
    if len(settings.jwt_secret) < 32 or settings.jwt_secret == "dev-insecure-secret-change-me":
        missing.append("JWT_SECRET (at least 32 random characters)")
    if not settings.max_bot_token:
        missing.append("MAX_BOT_TOKEN")
    if missing:
        raise RuntimeError("Production configuration is incomplete: " + ", ".join(missing))


def _migrate() -> None:
    Base.metadata.create_all(bind=engine)
    with engine.begin() as connection:
        tables = set(inspect(connection).get_table_names())
        for table, columns in _COLUMN_ADDITIONS.items():
            if table not in tables:
                continue
            existing = {column["name"] for column in inspect(connection).get_columns(table)}
            for column, definition in columns.items():
                if column not in existing:
                    connection.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {definition}"))
                    logger.info("Migrated: %s.%s added", table, column)
                    if (table, column) == ("student_skills", "status"):
                        # existing curator confirmations become the "verified" review status
                        connection.execute(text("UPDATE student_skills SET status = 'verified' WHERE is_verified = TRUE"))


async def _run_periodic_jobs():
    while True:
        await asyncio.to_thread(run_scheduled_pass)
        await asyncio.sleep(settings.scheduler_interval_seconds)


async def _run_outbox():
    while True:
        await asyncio.to_thread(deliver_outbox)
        await asyncio.sleep(settings.outbox_interval_seconds)


@asynccontextmanager
async def lifespan(app: FastAPI):
    _check_production_config()
    if not settings.max_webhook_secret:
        logger.warning("MAX_WEBHOOK_SECRET is not set: incoming webhook calls are not authenticated")
    _migrate()
    db = SessionLocal()
    try:
        ensure_starter_skills(db)
        if settings.enable_demo_data:
            ensure_demo_data(db)
    finally:
        db.close()

    tasks = [asyncio.create_task(_run_periodic_jobs()), asyncio.create_task(_run_outbox())]
    yield
    for task in tasks:
        task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await task


app = FastAPI(
    title="ПрактикаПлюс API",
    version="2.0.0",
    description=(
        "API сервиса ПрактикаПлюс: стажировки для студентов по навыкам, подтверждённым куратором вуза. "
        "Мини-приложение и бот работают в мессенджере MAX, кабинет вуза и работодателя — в вебе.\n\n"
        "Авторизация: `Authorization: Bearer <JWT>`. Студент получает токен в `POST /api/auth` "
        "(подписанные данные запуска MAX или sandbox-id `dev-…`), организация — в `POST /api/login`."
    ),
    lifespan=lifespan,
    openapi_tags=[
        {"name": "auth", "description": "Вход студентов (MAX) и организаций (email + пароль)"},
        {"name": "profile", "description": "Профиль, согласия, навыки, прогресс и сброс профиля"},
        {"name": "vacancies", "description": "Лента стажировок с индексом соответствия и управление вакансиями"},
        {"name": "applications", "description": "Отклики, тестовые задания, решения работодателя"},
        {"name": "students", "description": "Куратор: подтверждение навыков; работодатель: каталог талантов; сертификаты"},
        {"name": "analytics", "description": "Региональная аналитика, разрыв компетенций, воронка, витрина талантов"},
        {"name": "skill-tests", "description": "Тесты навыков от вуза (в том числе совместно с работодателем); успешная сдача подтверждает навык"},
        {"name": "integrations", "description": "Подключение ATS, сайтов вакансий и систем вуза (коннекторы описаны, обмен включается на пилоте)"},
        {"name": "team", "description": "Рабочее пространство организации: владелец приглашает рекрутеров и кураторов"},
        {"name": "groups", "description": "Академические группы вуза с QR-кодом и ссылкой-приглашением"},
        {"name": "max-bot", "description": "Вебхук бота MAX"},
        {"name": "public", "description": "Методы без авторизации"},
    ],
)

@app.middleware("http")
async def unhandled_errors(request: Request, call_next):
    """Registered before CORS, so it sits *inside* it: an unexpected error
    still reaches the browser as JSON with CORS headers (a readable
    message and a retry button) instead of an opaque network failure."""
    try:
        return await call_next(request)
    except Exception:
        logger.exception("Unhandled error on %s %s", request.method, request.url.path)
        return JSONResponse(status_code=500, content={"detail": "Internal server error"})


app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(RequestValidationError)
async def validation_error_handler(request: Request, exc: RequestValidationError):
    """422 with a single human-readable `detail` string (plus the raw errors),
    so every client can show the message without parsing pydantic output."""
    first = exc.errors()[0] if exc.errors() else {}
    field = ".".join(str(p) for p in first.get("loc", []) if p != "body")
    message = first.get("msg", "Invalid request")
    return JSONResponse(status_code=422, content={"detail": f"{field}: {message}" if field else message, "errors": jsonable_errors(exc)})


def jsonable_errors(exc: RequestValidationError) -> list[dict]:
    return [{"loc": list(e.get("loc", [])), "msg": e.get("msg", ""), "type": e.get("type", "")} for e in exc.errors()]


app.include_router(webhook.router)
app.include_router(auth.router)
app.include_router(profile.router)
app.include_router(vacancies.router)
app.include_router(applications.router)
app.include_router(students.router)
app.include_router(analytics.router)
app.include_router(skill_tests.router)
app.include_router(integrations.router)
app.include_router(team.router)
app.include_router(groups.router)


@app.get("/health", response_model=HealthOut, tags=["public"], summary="Состояние сервиса и БД")
@app.get("/api/health", response_model=HealthOut, tags=["public"], include_in_schema=False)
def health():
    database = True
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
    except Exception:
        database = False
    body = HealthOut(ok=database, database=database, max_bot="mock" if max_client.mock_mode else "live")
    return JSONResponse(status_code=200 if database else 503, content=body.model_dump())
