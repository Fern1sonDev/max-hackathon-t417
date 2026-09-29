from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration, loaded from environment / .env.

    ENV=prod enforces production secrets at startup (strong JWT_SECRET,
    MAX_BOT_TOKEN). Independently of ENV:
      * SANDBOX_LOGIN lets the mini app be opened in a plain browser under a
        *sandbox* identity (`dev-…` / `demo-…` ids only). Real MAX users have
        numeric ids and can only sign in with HMAC-signed MAX launch data, so
        the sandbox can never be used to impersonate them (see routers/auth.py).
      * ENABLE_DEMO_DATA makes sure the demo organisations, students and
        vacancies used for the jury check exist (idempotent, demo-* rows only).
    """

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    env: str = "dev"
    sandbox_login: bool = True
    enable_demo_data: bool = False
    terms_version: str = "2026-09-23"
    privacy_version: str = "2026-09-23"
    app_base_url: str = "http://localhost:8000"
    port: int = 8000

    database_url: str = "postgresql+psycopg2://praktikaplus:praktikaplus@db:5432/praktikaplus"

    jwt_secret: str = "dev-insecure-secret-change-me"
    jwt_algorithm: str = "HS256"
    jwt_ttl_hours: int = 12

    max_bot_token: str = ""
    max_webhook_secret: str = ""
    max_api_base_url: str = "https://platform-api2.max.ru"
    max_bot_username: str = "t417_hakaton_max_bot"
    # PWA mini app URL (the HTTPS origin registered for the bot's mini app).
    max_miniapp_url: str = "https://bot.praktikaplus.max.it-integrators.ru"
    # ЛК origin, used to build shareable public certificate links.
    lk_public_url: str = "https://lk.praktikaplus.max.it-integrators.ru"

    # Minimum match index (%) for a proactive "this vacancy suits you" bot
    # notification — tunable without a code change via MATCH_THRESHOLD.
    match_threshold: float = 60.0

    # SLA anti-ignore: a pending application is shown as "overdue" in the ЛК
    # after sla_warn_hours, and auto-escalated to status "missed" (with the
    # student notified) after sla_total_hours of no HR action.
    sla_warn_hours: float = 48.0
    sla_total_hours: float = 72.0
    # A student who registered but made zero applications within this many
    # days is flagged as "passive" for their curator and gets one nudge.
    passive_days: float = 5.0
    # How often the background scheduler (SLA escalation + passive nudge)
    # runs, in seconds.
    scheduler_interval_seconds: int = 900
    # Undo window: an employer's decision reaches the student this many
    # seconds later; delayed bot messages are delivered every outbox_interval.
    decision_grace_seconds: int = 90
    outbox_interval_seconds: int = 5
    # The bot answers users it doesn't know (no profile, no valid invite)
    # with the start message at most once per this many minutes.
    unknown_user_reply_minutes: int = 10

    # Brute-force protection for the organisation login (per IP + email).
    login_max_attempts: int = 10
    login_window_seconds: int = 300

    # comma-separated list; override via CORS_ORIGINS env if the domains change.
    cors_origins: str = (
        "https://lk.praktikaplus.max.it-integrators.ru,"
        "https://bot.praktikaplus.max.it-integrators.ru,"
        "https://praktikaplus.max.it-integrators.ru,"
        "http://localhost:8002,http://localhost:8003,http://localhost:8004,"
        "http://localhost:5173,http://localhost:5174,http://localhost:5175"
    )

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
