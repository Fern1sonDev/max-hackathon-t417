import datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Table,
    Text,
    UniqueConstraint,
    true,
)
from sqlalchemy.orm import relationship

from app.database import Base


class User(Base):
    """Students, employer staff and university staff.

    Organisations: the account that registered a company or a university is
    its *owner* (org_owner_id is NULL, the row's name is the organisation's
    name for companies). Staff invited by the owner — recruiters or curators —
    point to the owner through org_owner_id and work in the same workspace.
    """

    __tablename__ = "users"

    user_id = Column(String, primary_key=True)  # MAX user id for students, "<role>-<email>" for staff
    role = Column(String, nullable=False)  # student | hr | curator
    name = Column(String, nullable=False)
    contact_info = Column(String, default="")
    phone = Column(String, default="")
    position = Column(String, default="")  # staff: "HR-директор", "Рекрутер", "Куратор практики"
    person_name = Column(String, default="")  # company owner: the person behind the company account
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    email = Column(String, unique=True, nullable=True)
    password_hash = Column(String, nullable=True)
    org_owner_id = Column(String, nullable=True)  # staff member -> organisation owner

    # student: university/group (group_id when joined via a group invite);
    # curator: the university the organisation represents.
    university = Column(String, default="")
    group = Column(String, default="")
    group_id = Column(Integer, nullable=True)
    region = Column(String, default="")
    city = Column(String, default="")

    directory_opt_in = Column(Boolean, default=False)  # university opened its catalogue to employers
    student_directory_opt_in = Column(Boolean, default=False)  # student allows being found
    avatar_url = Column(String, default="")  # MAX profile photo
    portfolio_token = Column(String, nullable=True, unique=True)
    portfolio_public = Column(Boolean, default=False)
    portfolio_show_contact = Column(Boolean, default=False)
    terms_accepted_at = Column(DateTime, nullable=True)
    terms_version = Column(String, default="")
    privacy_accepted_at = Column(DateTime, nullable=True)
    privacy_version = Column(String, default="")

    skills = relationship(
        "StudentSkill", back_populates="student", cascade="all, delete-orphan", foreign_keys="StudentSkill.student_id"
    )


class StudentGroup(Base):
    """An academic group of a university with its own invite link / QR code.
    Students who join through it get university, group, region and city
    filled in and locked."""

    __tablename__ = "student_groups"

    group_id = Column(Integer, primary_key=True, autoincrement=True)
    org_id = Column(String, ForeignKey("users.user_id"), nullable=False)  # university owner account
    university = Column(String, nullable=False)
    name = Column(String, nullable=False)
    course = Column(Integer, default=0)
    specialty = Column(String, default="")
    region = Column(String, default="")
    city = Column(String, default="")
    curator_id = Column(String, ForeignKey("users.user_id"), nullable=True)
    invite_code = Column(String, unique=True, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    curator = relationship("User", foreign_keys=[curator_id])


class OrgInvite(Base):
    """Invitation of a recruiter/curator into an organisation workspace."""

    __tablename__ = "org_invites"

    token = Column(String, primary_key=True)
    org_owner_id = Column(String, ForeignKey("users.user_id"), nullable=False)
    role = Column(String, nullable=False)  # hr | curator
    name = Column(String, default="")
    email = Column(String, nullable=False)
    position = Column(String, default="")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    expires_at = Column(DateTime, nullable=False)
    used_at = Column(DateTime, nullable=True)


class Skill(Base):
    __tablename__ = "skills"

    skill_id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, unique=True, nullable=False)


class StudentSkill(Base):
    """A skill a student claims. The university reviews it:

    claimed          — stated by the student, not reviewed yet
    verified         — confirmed by the university (curator or passed test), with an optional comment
    employer_review  — «на усмотрение работодателя»: can't be proven academically,
                       but the curator vouches the student has it
    rejected         — not confirmed (kept so the student sees the reason)
    `is_verified` mirrors status == "verified" for compatibility.
    """

    __tablename__ = "student_skills"
    __table_args__ = (UniqueConstraint("student_id", "skill_id", name="uq_student_skill"),)

    id = Column(Integer, primary_key=True, autoincrement=True)
    student_id = Column(String, ForeignKey("users.user_id"), nullable=False)
    skill_id = Column(Integer, ForeignKey("skills.skill_id"), nullable=False)
    is_verified = Column(Boolean, default=False)
    status = Column(String, default="claimed")
    comment = Column(String, default="")

    verified_by = Column(String, ForeignKey("users.user_id"), nullable=True)  # reviewer
    verified_at = Column(DateTime, nullable=True)  # review time

    student = relationship("User", back_populates="skills", foreign_keys=[student_id])
    skill = relationship("Skill")
    verifier = relationship("User", foreign_keys=[verified_by])


# which skills a vacancy requires; `is_core` — key (weight 2) vs nice-to-have (weight 1)
vacancy_required_skills = Table(
    "vacancy_required_skills",
    Base.metadata,
    Column("vacancy_id", Integer, ForeignKey("vacancies.vacancy_id"), primary_key=True),
    Column("skill_id", Integer, ForeignKey("skills.skill_id"), primary_key=True),
    Column("is_core", Boolean, nullable=False, server_default=true(), default=True),
)


class Vacancy(Base):
    __tablename__ = "vacancies"

    vacancy_id = Column(Integer, primary_key=True, autoincrement=True)
    company_id = Column(String, ForeignKey("users.user_id"), nullable=False)  # company owner account
    title = Column(String, nullable=False)
    description = Column(Text, default="")
    test_task = Column(Text, default="")  # numbered questions as text (bot message, CSV)
    test_questions = Column(Text, default="")  # JSON list of questions
    region = Column(String, default="")
    city = Column(String, default="")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    company = relationship("User", foreign_keys=[company_id])
    required_skills = relationship("Skill", secondary=vacancy_required_skills)
    applications = relationship("Application", back_populates="vacancy")


class Application(Base):
    __tablename__ = "applications"

    app_id = Column(Integer, primary_key=True, autoincrement=True)
    student_id = Column(String, ForeignKey("users.user_id"), nullable=False)
    vacancy_id = Column(Integer, ForeignKey("vacancies.vacancy_id"), nullable=False)
    status = Column(String, default="pending")  # pending | accepted | rejected | missed
    test_answer = Column(Text, default="")  # all answers as text (chat reply / CSV)
    test_answers = Column(Text, default="")  # JSON list, one answer per question
    # Grace period: a decision reaches the student (bot + app) only at
    # decision_visible_at; until then the employer can undo it.
    previous_status = Column(String, default="")
    decision_visible_at = Column(DateTime, nullable=True)
    next_step = Column(Text, default="")  # JSON: format, datetime, place, contact, message

    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    student = relationship("User", foreign_keys=[student_id])
    vacancy = relationship("Vacancy", back_populates="applications")
    events = relationship(
        "ApplicationEvent", back_populates="application", cascade="all, delete-orphan", order_by="ApplicationEvent.id"
    )


class ApplicationEvent(Base):
    """Status timeline of an application — shown to the student as a tracker
    and to the employer on the candidate card."""

    __tablename__ = "application_events"

    id = Column(Integer, primary_key=True, autoincrement=True)
    app_id = Column(Integer, ForeignKey("applications.app_id"), nullable=False, index=True)
    kind = Column(String, nullable=False)  # created | answered | accepted | rejected | pending | missed | undone
    note = Column(String, default="")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    application = relationship("Application", back_populates="events")


class OutboxMessage(Base):
    """Bot messages sent with a delay (decisions with an undo window, batched
    review summaries). A background loop delivers due, non-cancelled rows."""

    __tablename__ = "outbox"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String, nullable=False)
    text = Column(Text, nullable=False)
    buttons = Column(Text, default="")  # JSON rows of buttons
    app_id = Column(Integer, nullable=True)
    kind = Column(String, default="")
    send_after = Column(DateTime, nullable=False)
    sent_at = Column(DateTime, nullable=True)
    cancelled_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class SkillTest(Base):
    """A short skill test set by a university — alone or with a partner
    employer (an employer may propose one; a curator publishes it). Passing a
    published test verifies the skill on the university's behalf."""

    __tablename__ = "skill_tests"

    test_id = Column(Integer, primary_key=True, autoincrement=True)
    title = Column(String, nullable=False)
    description = Column(Text, default="")
    skill_id = Column(Integer, ForeignKey("skills.skill_id"), nullable=False)
    university = Column(String, nullable=False)
    author_id = Column(String, ForeignKey("users.user_id"), nullable=False)
    partner_company_id = Column(String, ForeignKey("users.user_id"), nullable=True)
    approved_by = Column(String, ForeignKey("users.user_id"), nullable=True)
    status = Column(String, default="published")  # draft | pending | published
    pass_score = Column(Integer, default=70)
    max_attempts = Column(Integer, default=3)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    skill = relationship("Skill")
    author = relationship("User", foreign_keys=[author_id])
    partner = relationship("User", foreign_keys=[partner_company_id])
    questions = relationship("TestQuestion", back_populates="test", cascade="all, delete-orphan", order_by="TestQuestion.position")
    attempts = relationship("TestAttempt", back_populates="test", cascade="all, delete-orphan")


class TestQuestion(Base):
    __tablename__ = "test_questions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    test_id = Column(Integer, ForeignKey("skill_tests.test_id"), nullable=False, index=True)
    position = Column(Integer, default=0)
    text = Column(Text, nullable=False)
    options = Column(Text, nullable=False)  # JSON list of strings
    correct_index = Column(Integer, nullable=False)

    test = relationship("SkillTest", back_populates="questions")


class TestAttempt(Base):
    __tablename__ = "test_attempts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    test_id = Column(Integer, ForeignKey("skill_tests.test_id"), nullable=False, index=True)
    student_id = Column(String, ForeignKey("users.user_id"), nullable=False, index=True)
    score = Column(Integer, nullable=False)
    passed = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    test = relationship("SkillTest", back_populates="attempts")


class IntegrationConnection(Base):
    """An organisation's connection to an external system (ATS, job board,
    university LMS/ERP). Only non-secret settings are stored."""

    __tablename__ = "integration_connections"
    __table_args__ = (UniqueConstraint("org_id", "connector_id", name="uq_org_connector"),)

    id = Column(Integer, primary_key=True, autoincrement=True)
    org_id = Column(String, ForeignKey("users.user_id"), nullable=False)
    connector_id = Column(String, nullable=False)
    status = Column(String, default="pending")
    settings = Column(Text, default="{}")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)


class NotifiedMatch(Base):
    """Dedup log for proactive "this vacancy suits you" notifications."""

    __tablename__ = "notified_matches"
    __table_args__ = (UniqueConstraint("student_id", "vacancy_id", name="uq_notified_match"),)

    id = Column(Integer, primary_key=True, autoincrement=True)
    student_id = Column(String, ForeignKey("users.user_id"), nullable=False)
    vacancy_id = Column(Integer, ForeignKey("vacancies.vacancy_id"), nullable=False)
    notified_at = Column(DateTime, default=datetime.datetime.utcnow)


class PassiveNudge(Base):
    """Dedup log for the one-time nudge to a student who never applied."""

    __tablename__ = "passive_nudges"

    id = Column(Integer, primary_key=True, autoincrement=True)
    student_id = Column(String, ForeignKey("users.user_id"), nullable=False, unique=True)
    nudged_at = Column(DateTime, default=datetime.datetime.utcnow)


class BotContact(Base):
    """Rate limit for replies to users the bot doesn't know yet."""

    __tablename__ = "bot_contacts"

    user_id = Column(String, primary_key=True)
    last_reply_at = Column(DateTime, nullable=True)


class SearchLog(Base):
    """One row per skill tag a student filters the feed by — powers the
    "unmet demand" analytics."""

    __tablename__ = "search_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    student_id = Column(String, ForeignKey("users.user_id"), nullable=False)
    skill_name = Column(String, nullable=False)
    result_count = Column(Integer, nullable=False)
    searched_at = Column(DateTime, default=datetime.datetime.utcnow)
