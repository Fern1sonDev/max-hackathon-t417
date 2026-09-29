import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.skills_catalog import canonical_name, skill_key

Role = Literal["student", "hr", "curator"]
SkillStatus = Literal["claimed", "verified", "employer_review", "rejected"]


def _clean_skill_list(values: list[str]) -> list[str]:
    """Trim, canonicalise and de-duplicate skill tags, keeping order."""
    out: list[str] = []
    seen: set[str] = set()
    for value in values:
        name = canonical_name(value)
        key = skill_key(name)
        if not key or key in seen:
            continue
        if len(name) > 60:
            raise ValueError("Skill names must be at most 60 characters")
        seen.add(key)
        out.append(name)
    return out


class ErrorOut(BaseModel):
    detail: str


class HealthOut(BaseModel):
    ok: bool
    database: bool
    max_bot: Literal["live", "mock"]


# ---- auth ------------------------------------------------------------------

class AuthRequest(BaseModel):
    """Payload the mini app sends after reading MAX launch params (students
    only — organisations use POST /api/register + /api/login).

    Inside MAX, `init_data` (window.WebApp.initData, HMAC-signed by MAX) is
    the only trusted source of identity. `user_id`/`name` are the browser
    sandbox fallback (SANDBOX_LOGIN=true, `dev-…`/`demo-…` ids only)."""

    init_data: Optional[str] = None
    user_id: Optional[str] = Field(default=None, max_length=60)
    name: str = Field(default="Пользователь", max_length=120)


class AuthResponse(BaseModel):
    token: str
    role: Optional[str] = None
    profile_complete: bool = False
    start_param: Optional[str] = None


class RegisterIn(BaseModel):
    """Registers an organisation workspace; the registrant becomes its owner
    (HR director / university administrator) and can invite colleagues."""

    role: Literal["hr", "curator"]
    name: str = Field(min_length=2, max_length=120, description="Компания: название; вуз: ФИО администратора")
    person_name: str = Field(default="", max_length=120, description="Компания: ФИО владельца аккаунта")
    position: str = Field(default="", max_length=80)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    phone: str = Field(default="", max_length=40)
    university: str = Field(default="", max_length=200)
    region: str = Field(default="", max_length=100)
    city: str = Field(default="", max_length=100)
    accept_terms: bool = False
    accept_privacy: bool = False


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(max_length=128)


class PasswordChangeIn(BaseModel):
    current_password: str = Field(max_length=128)
    new_password: str = Field(min_length=8, max_length=128)


# ---- profile -----------------------------------------------------------------

class UserProfileIn(BaseModel):
    role: Role
    name: str = Field(min_length=1, max_length=120)
    contact_info: str = Field(default="", max_length=120)
    phone: str = Field(default="", max_length=40)
    university: str = Field(default="", max_length=200)
    group: str = Field(default="", max_length=50)
    region: str = Field(default="", max_length=100)
    city: str = Field(default="", max_length=100)
    group_code: Optional[str] = Field(default=None, max_length=40, description="Код приглашения группы — заполняет вуз, группу, регион и город")
    accept_terms: bool = False
    accept_privacy: bool = False

    @field_validator("name", "contact_info", "phone", "university", "group", "region", "city")
    @classmethod
    def _strip(cls, value: str) -> str:
        return value.strip()


class UserProfileOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user_id: str
    role: str
    name: str
    contact_info: str
    phone: str = ""
    position: str = ""
    person_name: str = ""
    university: str
    group: str
    group_id: Optional[int] = None
    group_locked: bool = False
    region: str
    city: str
    directory_opt_in: bool
    student_directory_opt_in: bool = False
    avatar_url: str = ""
    points: int = 0
    consent_complete: bool = False
    org_id: str = ""
    org_name: str = ""
    is_owner: bool = False
    portfolio_public: bool = False
    portfolio_url: str = ""
    portfolio_show_contact: bool = False


class DirectoryOptInPatch(BaseModel):
    directory_opt_in: bool


class StudentDirectoryOptInPatch(BaseModel):
    student_directory_opt_in: bool


class PortfolioPatch(BaseModel):
    public: bool
    show_contact: bool = False


class ResetOut(BaseModel):
    removed_skills: int
    removed_applications: int
    profile: UserProfileOut


class AchievementOut(BaseModel):
    key: str
    title: str
    description: str
    earned: bool
    progress: int
    goal: int


class StudentProgressOut(BaseModel):
    points: int
    level: int
    next_level_points: int
    achievements: list[AchievementOut]


class UniversityOut(BaseModel):
    name: str
    students: int
    has_curator: bool


class GeoRegionOut(BaseModel):
    region: str
    cities: list[str]


class GeoOut(BaseModel):
    source: str
    regions: list[GeoRegionOut]


# ---- organisations & teams ---------------------------------------------------------------

class TeamMemberOut(BaseModel):
    user_id: str
    name: str
    email: str
    position: str
    is_owner: bool
    created_at: datetime.datetime


class TeamInviteIn(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    position: str = Field(default="", max_length=80)


class TeamInviteOut(BaseModel):
    token: str
    name: str
    email: str
    position: str
    url: str
    expires_at: datetime.datetime


class TeamOut(BaseModel):
    org_name: str
    role: str
    members: list[TeamMemberOut]
    invites: list[TeamInviteOut]


class InvitePublicOut(BaseModel):
    org_name: str
    role: str
    name: str
    email: str
    position: str


class InviteAcceptIn(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    password: str = Field(min_length=8, max_length=128)
    accept_terms: bool = False
    accept_privacy: bool = False


# ---- groups -------------------------------------------------------------------------------------

class GroupIn(BaseModel):
    name: str = Field(min_length=1, max_length=50)
    course: int = Field(default=0, ge=0, le=6)
    specialty: str = Field(default="", max_length=120)
    region: str = Field(default="", max_length=100)
    city: str = Field(default="", max_length=100)
    curator_id: Optional[str] = None


class GroupOut(BaseModel):
    group_id: int
    name: str
    course: int
    specialty: str
    university: str
    region: str
    city: str
    curator_id: Optional[str] = None
    curator_name: str = ""
    invite_code: str
    invite_url: str
    students_count: int = 0
    to_review: int = 0
    with_applications: int = 0
    accepted: int = 0
    passive: int = 0


class GroupInvitePublicOut(BaseModel):
    university: str
    group: str
    region: str
    city: str
    course: int
    specialty: str


# ---- skills ----------------------------------------------------------------------

class SkillOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    skill_id: int
    name: str


class StudentSkillOut(BaseModel):
    skill_id: int
    name: str
    is_verified: bool
    status: str = "claimed"
    comment: str = ""
    reviewed_by: str = ""
    reviewed_at: Optional[datetime.datetime] = None


class SkillClaimIn(BaseModel):
    skill_name: str = Field(min_length=1, max_length=60)

    @field_validator("skill_name")
    @classmethod
    def _canonical(cls, value: str) -> str:
        name = canonical_name(value)
        if not name:
            raise ValueError("Skill name cannot be empty")
        return name


class SkillVerifyIn(BaseModel):
    is_verified: bool


class SkillDecisionIn(BaseModel):
    skill_id: int
    status: SkillStatus
    comment: str = Field(default="", max_length=300)


class SkillReviewIn(BaseModel):
    """A curator's batch review of one student's skills — saved at once, one
    summary notification to the student."""

    decisions: list[SkillDecisionIn] = Field(min_length=1, max_length=50)


class SkillReviewOut(BaseModel):
    changed: int
    notified: bool
    student: "StudentOut"


class CertificateLinkOut(BaseModel):
    url: str


class CertificateOut(BaseModel):
    student_name: str
    university: str
    skill: str
    verified_by_name: str
    verified_at: datetime.datetime
    comment: str = ""


class StudentOut(BaseModel):
    user_id: str
    name: str
    contact_info: str
    phone: str = ""
    university: str
    group: str
    group_id: Optional[int] = None
    region: str
    city: str
    skills: list[StudentSkillOut]
    is_passive: bool = False
    avatar_url: str = ""
    applications: int = 0
    accepted: int = 0


class StudentEditIn(BaseModel):
    """Curator-only edit of a student's directory fields."""

    group_id: Optional[int] = None
    university: Optional[str] = Field(default=None, max_length=200)
    group: Optional[str] = Field(default=None, max_length=50)
    region: Optional[str] = Field(default=None, max_length=100)
    city: Optional[str] = Field(default=None, max_length=100)


class PortfolioOut(BaseModel):
    name: str
    avatar_url: str
    university: str
    group: str
    city: str
    region: str
    contact: str = ""
    verified: list[StudentSkillOut]
    employer_review: list[StudentSkillOut]
    claimed: list[str]
    tests_passed: list[str]
    points: int
    certificate_urls: dict[str, str]


# ---- match index -------------------------------------------------------------------

class MatchItemOut(BaseModel):
    skill: str
    is_core: bool
    status: Literal["verified", "employer", "claimed", "related", "missing"]
    via: Optional[str] = None


class MatchOut(BaseModel):
    """Explainable match index — see app/match_score.py for the formula."""

    score: float = Field(description="Индекс по всем навыкам с учётом доверия, 0–100")
    verified_score: float = Field(description="Та же формула только по навыкам, подтверждённым вузом")
    potential: float = Field(description="Индекс, если вуз подтвердит все заявленные навыки")
    level: Literal["high", "medium", "low", "none"]
    items: list[MatchItemOut]
    missing: list[str]
    missing_core: list[str]


# ---- vacancies ------------------------------------------------------------------------

class VacancyIn(BaseModel):
    title: str = Field(min_length=3, max_length=120)
    description: str = Field(default="", max_length=4000)
    test_task: str = Field(default="", max_length=2000, description="Устаревшее поле: один вопрос; используйте test_questions")
    test_questions: list[str] = Field(default_factory=list, max_length=10)
    region: str = Field(default="", max_length=100)
    city: str = Field(default="", max_length=100)
    required_skills: list[str] = Field(default_factory=list, max_length=20, description="Ключевые навыки (вес 2)")
    optional_skills: list[str] = Field(default_factory=list, max_length=20, description="Желательные навыки (вес 1)")

    @field_validator("title", "description", "test_task", "region", "city")
    @classmethod
    def _strip(cls, value: str) -> str:
        return value.strip()

    @field_validator("test_questions")
    @classmethod
    def _questions(cls, values: list[str]) -> list[str]:
        out = [v.strip() for v in values if v.strip()]
        if any(len(v) > 1000 for v in out):
            raise ValueError("Each question must be at most 1000 characters")
        return out

    @field_validator("required_skills", "optional_skills")
    @classmethod
    def _skills(cls, values: list[str]) -> list[str]:
        return _clean_skill_list(values)


class VacancyStats(BaseModel):
    total: int = 0
    pending: int = 0
    accepted: int = 0
    rejected: int = 0
    missed: int = 0
    answered: int = 0
    new_24h: int = 0
    avg_match: float = 0.0


class VacancyOut(BaseModel):
    vacancy_id: int
    company_id: str
    company_name: str
    title: str
    description: str
    test_task: str = ""
    test_questions: list[str] = []
    test_questions_count: int = 0
    has_test_task: bool = False
    region: str
    city: str
    is_active: bool
    required_skills: list[str] = Field(description="Все требования (ключевые и желательные)")
    core_skills: list[str] = []
    optional_skills: list[str] = []
    created_at: datetime.datetime
    applications_count: Optional[int] = None  # only for the owning company
    stats: Optional[VacancyStats] = None  # only for the owning company
    match_score: Optional[float] = None  # only when the caller is a student
    missing_skills: list[str] = []
    match: Optional[MatchOut] = None
    my_application_status: Optional[str] = None


class VacancyActivePatch(BaseModel):
    is_active: bool


# ---- applications ---------------------------------------------------------------------

class ApplyIn(BaseModel):
    vacancy_id: int


class ApplicationAnswerIn(BaseModel):
    answer: str = Field(default="", max_length=10000, description="Устаревшее: один ответ")
    answers: list[str] = Field(default_factory=list, max_length=10)


class ApplicationEventOut(BaseModel):
    kind: str
    note: str
    created_at: datetime.datetime


class NextStepIn(BaseModel):
    format: Literal["online", "office", "start", "call"] = "online"
    datetime: str = Field(default="", max_length=60)
    place: str = Field(default="", max_length=300, description="Адрес или ссылка на встречу")
    contact_name: str = Field(default="", max_length=120)
    contact_phone: str = Field(default="", max_length=40)
    message: str = Field(default="", max_length=2000)


class NextStepOut(NextStepIn):
    pass


class ApplicationOut(BaseModel):
    app_id: int
    vacancy_id: int
    vacancy_title: str
    company_name: str = ""
    student_id: str
    student_name: str
    student_university: str = ""
    student_group: str = ""
    student_contact: str = ""
    student_phone: str = ""
    student_avatar_url: str = ""
    test_task: str = ""
    test_questions: list[str] = []
    test_answer: str = ""
    test_answers: list[str] = []
    status: str
    match_score: float
    match: Optional[MatchOut] = None
    skills_verified: bool  # every requirement is verified by the university
    created_at: datetime.datetime
    updated_at: datetime.datetime
    is_overdue: bool = False
    events: list[ApplicationEventOut] = []
    next_step: Optional[NextStepOut] = None
    pending_decision_until: Optional[datetime.datetime] = None  # employer view: undo window
    company_contact: str = ""  # student view after an invitation


class ApplicationStatusPatch(BaseModel):
    status: Literal["pending", "accepted", "rejected"]
    message: str = Field(default="", max_length=2000, description="Сообщение кандидату (для отказа)")
    next_step: Optional[NextStepIn] = None


# ---- analytics -------------------------------------------------------------------------

class RegionStat(BaseModel):
    region: str
    students: int
    vacancies: int


class SkillGapStat(BaseModel):
    skill: str
    required: int
    verified: int


class UnmetDemandStat(BaseModel):
    skill: str
    searches: int
    avg_results: float


class LeaderboardEntry(BaseModel):
    student_id: str
    name: str
    university: str
    points: int
    verified_skills_count: int
    avatar_url: str = ""


class FunnelOut(BaseModel):
    """Aggregated funnel for the caller's scope (company: own vacancies; university: its students)."""

    applications: int
    answered: int
    accepted: int
    rejected: int
    missed: int
    avg_match: float
    median_hours_to_decision: Optional[float] = None


class EmployerStat(BaseModel):
    company: str
    region: str
    city: str
    vacancies: int
    applications_from_us: int
    accepted_from_us: int
    top_skills: list[str]


class SkillDemandStat(BaseModel):
    skill: str
    vacancies: int
    our_verified: int
    our_claimed: int


class GroupStat(BaseModel):
    group: str
    students: int
    with_applications: int
    accepted: int
    verified_share: float


class UniversityAnalyticsOut(BaseModel):
    region: str
    city: str
    students: int
    groups: int
    verified_skills: int
    to_review: int
    applications: int
    accepted: int
    employers_in_region: int
    vacancies_in_region: int
    employers: list[EmployerStat]
    skills_demand: list[SkillDemandStat]
    by_group: list[GroupStat]


# ---- skill tests (university + employer) --------------------------------------------

class TestQuestionIn(BaseModel):
    text: str = Field(min_length=3, max_length=1000)
    options: list[str] = Field(min_length=2, max_length=6)
    correct_index: int = Field(ge=0)

    @field_validator("options")
    @classmethod
    def _options(cls, values: list[str]) -> list[str]:
        cleaned = [v.strip() for v in values]
        if any(not v or len(v) > 300 for v in cleaned):
            raise ValueError("Options must be 1–300 characters")
        return cleaned


class SkillTestIn(BaseModel):
    title: str = Field(min_length=3, max_length=120)
    description: str = Field(default="", max_length=1000)
    skill: str = Field(min_length=1, max_length=60)
    pass_score: int = Field(default=70, ge=50, le=100)
    max_attempts: int = Field(default=3, ge=1, le=10)
    questions: list[TestQuestionIn] = Field(min_length=3, max_length=20)
    university: str = Field(default="", max_length=200, description="Для работодателя — вуз, которому предлагается тест")
    partner_company_id: Optional[str] = Field(default=None, description="Для куратора — работодатель-соавтор")
    publish: bool = True

    @field_validator("skill")
    @classmethod
    def _skill(cls, value: str) -> str:
        return canonical_name(value)


class SkillTestStatusPatch(BaseModel):
    status: Literal["draft", "published"]


class TestQuestionOut(BaseModel):
    id: int
    text: str
    options: list[str]
    correct_index: Optional[int] = None  # only for the test's authors


class SkillTestOut(BaseModel):
    test_id: int
    title: str
    description: str
    skill: str
    university: str
    author_name: str
    author_role: str
    partner_company_id: Optional[str] = None
    partner_name: str = ""
    status: str
    pass_score: int
    max_attempts: int
    questions_count: int
    created_at: datetime.datetime
    attempts_used: Optional[int] = None
    best_score: Optional[int] = None
    passed: Optional[bool] = None
    attempts_total: Optional[int] = None
    pass_rate: Optional[float] = None
    can_manage: bool = False
    questions: Optional[list[TestQuestionOut]] = None


class TestAttemptIn(BaseModel):
    answers: list[int] = Field(min_length=1, max_length=20)


class TestAttemptOut(BaseModel):
    score: int
    passed: bool
    correct: list[bool]
    attempts_left: int
    skill: str
    skill_verified: bool


class CompanyOut(BaseModel):
    user_id: str
    name: str


# ---- integrations ------------------------------------------------------------------------

class IntegrationFieldOut(BaseModel):
    key: str
    label: str
    placeholder: str
    secret: bool
    required: bool


class IntegrationOut(BaseModel):
    id: str
    name: str
    vendor: str
    category: str
    category_label: str
    summary: str
    capabilities: list[str]
    auth: str
    docs: str
    fields: list[IntegrationFieldOut]
    connected: bool = False
    status: Optional[str] = None
    status_label: str = ""
    settings: dict[str, str] = {}
    connected_at: Optional[datetime.datetime] = None


class IntegrationConnectIn(BaseModel):
    settings: dict[str, str] = Field(default_factory=dict)


SkillReviewOut.model_rebuild()
