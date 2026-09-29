"""Индекс соответствия (Match Index) — how well *all* of a student's skills
cover a vacancy's requirements, weighted by how much each skill is trusted.

    index = Σ weight(req) × credit(req) / Σ weight(req) × 100%

    weight: 2 — core ("ключевой") requirement, 1 — nice-to-have
    credit: 1.00  verified by the university (curator or a passed university test)
            0.75  «на усмотрение работодателя» — the curator vouches the student
                  has it, though it can't be proven academically
            0.50  claimed by the student, not reviewed yet
            0.50  adjacent verified skill of the same family (FreeBSD for Linux)
            0.25  adjacent claimed skill
            0     missing or rejected by the university

Two companion numbers keep the index honest and explainable:
  verified_score — the same formula counting only university-verified skills;
  potential      — the index if the university confirms everything claimed.

`compute_match()` is a pure function (unit-tested in
backend/tests/test_match_score.py); the helpers below batch the DB lookups so
a feed of N vacancies costs a constant number of queries.
"""

from dataclasses import dataclass, field

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Skill, StudentSkill, Vacancy, vacancy_required_skills
from app.skills_catalog import family_of, skill_key

CORE_WEIGHT = 2
OPTIONAL_WEIGHT = 1
CREDIT = {"verified": 1.0, "employer": 0.75, "claimed": 0.5, "related": 0.5, "related_claimed": 0.25, "missing": 0.0}


@dataclass(frozen=True)
class Requirement:
    name: str
    is_core: bool = True


@dataclass
class SkillSets:
    """A student's skills by review status (display names). Rejected skills
    are simply not listed."""

    verified: list[str] = field(default_factory=list)
    claimed: list[str] = field(default_factory=list)
    employer: list[str] = field(default_factory=list)  # «на усмотрение работодателя»


@dataclass
class MatchItem:
    skill: str
    is_core: bool
    status: str  # verified | employer | claimed | related | missing
    credit: float
    via: str | None = None  # the adjacent skill, for status == "related"


@dataclass
class MatchResult:
    score: float
    verified_score: float
    potential: float
    items: list[MatchItem]

    @property
    def missing(self) -> list[str]:
        """Requirements not yet backed by a university-verified skill."""
        return [item.skill for item in self.items if item.status != "verified"]

    @property
    def missing_core(self) -> list[str]:
        return [item.skill for item in self.items if item.is_core and item.status in ("missing", "related")]

    @property
    def level(self) -> str:
        if self.score >= 80:
            return "high"
        if self.score >= 50:
            return "medium"
        if self.score > 0:
            return "low"
        return "none"


def _weight(item: MatchItem) -> int:
    return CORE_WEIGHT if item.is_core else OPTIONAL_WEIGHT


def compute_match(skills: SkillSets, requirements: list[Requirement]) -> MatchResult:
    if not requirements:
        return MatchResult(score=0.0, verified_score=0.0, potential=0.0, items=[])

    verified = {skill_key(n): n for n in skills.verified}
    employer = {skill_key(n): n for n in skills.employer if skill_key(n) not in verified}
    claimed = {skill_key(n): n for n in skills.claimed if skill_key(n) not in verified and skill_key(n) not in employer}

    def families(names: dict[str, str]) -> dict[str, str]:
        out: dict[str, str] = {}
        for name in names.values():
            fam = family_of(name)
            if fam and fam not in out:
                out[fam] = name
        return out

    verified_fam, claimed_fam = families(verified), families({**employer, **claimed})

    items: list[MatchItem] = []
    seen: set[str] = set()
    for req in requirements:
        key = skill_key(req.name)
        if not key or key in seen:
            continue
        seen.add(key)
        fam = family_of(req.name)
        if key in verified:
            items.append(MatchItem(req.name, req.is_core, "verified", CREDIT["verified"]))
        elif key in employer:
            items.append(MatchItem(req.name, req.is_core, "employer", CREDIT["employer"]))
        elif key in claimed:
            items.append(MatchItem(req.name, req.is_core, "claimed", CREDIT["claimed"]))
        elif fam and fam in verified_fam:
            items.append(MatchItem(req.name, req.is_core, "related", CREDIT["related"], via=verified_fam[fam]))
        elif fam and fam in claimed_fam:
            items.append(MatchItem(req.name, req.is_core, "related", CREDIT["related_claimed"], via=claimed_fam[fam]))
        else:
            items.append(MatchItem(req.name, req.is_core, "missing", CREDIT["missing"]))

    total = sum(_weight(i) for i in items)
    score = sum(_weight(i) * i.credit for i in items) / total * 100
    verified_only = sum(_weight(i) * (1.0 if i.status == "verified" else CREDIT["related"] if i.status == "related" and i.via in verified.values() else 0.0) for i in items) / total * 100
    potential = sum(_weight(i) * (1.0 if i.status in ("verified", "employer", "claimed") else i.credit) for i in items) / total * 100
    return MatchResult(score=round(score, 1), verified_score=round(verified_only, 1), potential=round(potential, 1), items=items)


# ---- DB helpers ----------------------------------------------------------------

def load_skill_sets(db: Session, student_ids: list[str]) -> dict[str, SkillSets]:
    result = {student_id: SkillSets() for student_id in student_ids}
    if not student_ids:
        return result
    rows = db.execute(
        select(StudentSkill.student_id, Skill.name, StudentSkill.status, StudentSkill.is_verified)
        .join(Skill, Skill.skill_id == StudentSkill.skill_id)
        .where(StudentSkill.student_id.in_(student_ids))
    )
    for student_id, name, status, is_verified in rows:
        status = "verified" if is_verified else (status or "claimed")
        bucket = {"verified": result[student_id].verified, "employer_review": result[student_id].employer, "claimed": result[student_id].claimed}.get(status)
        if bucket is not None:
            bucket.append(name)
    return result


def load_requirements(db: Session, vacancy_ids: list[int]) -> dict[int, list[Requirement]]:
    result: dict[int, list[Requirement]] = {vacancy_id: [] for vacancy_id in vacancy_ids}
    if not vacancy_ids:
        return result
    rows = db.execute(
        select(vacancy_required_skills.c.vacancy_id, Skill.name, vacancy_required_skills.c.is_core)
        .join(Skill, Skill.skill_id == vacancy_required_skills.c.skill_id)
        .where(vacancy_required_skills.c.vacancy_id.in_(vacancy_ids))
        .order_by(vacancy_required_skills.c.vacancy_id, vacancy_required_skills.c.is_core.desc(), Skill.name)
    )
    for vacancy_id, name, is_core in rows:
        result[vacancy_id].append(Requirement(name, bool(is_core) if is_core is not None else True))
    return result


def match_for(db: Session, student_id: str, vacancy: Vacancy) -> MatchResult:
    skills = load_skill_sets(db, [student_id])[student_id]
    requirements = load_requirements(db, [vacancy.vacancy_id])[vacancy.vacancy_id]
    return compute_match(skills, requirements)


def calculate_match_score(db: Session, student_id: str, vacancy: Vacancy) -> float:
    return match_for(db, student_id, vacancy).score
