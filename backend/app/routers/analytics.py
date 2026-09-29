"""Aggregated analytics for organisations. Student counts use the same privacy
scope as the roster (services.visible_student_query)."""

from collections import Counter, defaultdict
from statistics import median

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth import get_current_user, require_role
from app.database import get_db
from app.gamification import calculate_points
from app.match_score import load_requirements
from app.models import Application, SearchLog, Skill, StudentGroup, StudentSkill, User, Vacancy, vacancy_required_skills
from app.schemas import (
    EmployerStat,
    FunnelOut,
    GroupStat,
    LeaderboardEntry,
    RegionStat,
    SkillDemandStat,
    SkillGapStat,
    UniversityAnalyticsOut,
    UnmetDemandStat,
)
from app.services import applications_out, org_owner, visible_student_query

router = APIRouter(prefix="/api", tags=["analytics"])


def _require_org(current: dict) -> None:
    require_role(current, "hr", "curator", detail="Only employers and curators can view analytics")


@router.get("/analytics/regions", response_model=list[RegionStat], summary="Студенты и активные стажировки по регионам")
def analytics_regions(current=Depends(get_current_user), db: Session = Depends(get_db)):
    _require_org(current)
    students = Counter(((r or "").strip() or "Не указан") for (r,) in visible_student_query(db, current).with_entities(User.region))
    vacancies = Counter(((r or "").strip() or "Не указан") for (r,) in db.query(Vacancy.region).filter(Vacancy.is_active.is_(True)))
    regions = sorted(set(students) | set(vacancies), key=lambda r: (r == "Не указан", -(students[r] + vacancies[r]), r))
    return [RegionStat(region=r, students=students[r], vacancies=vacancies[r]) for r in regions]


@router.get("/analytics/skills-gap", response_model=list[SkillGapStat], summary="Разрыв компетенций: спрос стажировок vs подтверждено вузами")
def analytics_skills_gap(current=Depends(get_current_user), db: Session = Depends(get_db)):
    _require_org(current)
    required = Counter(
        sid for (sid,) in db.query(vacancy_required_skills.c.skill_id).join(Vacancy, Vacancy.vacancy_id == vacancy_required_skills.c.vacancy_id).filter(Vacancy.is_active.is_(True))
    )
    if not required:
        return []
    ids = [row.user_id for row in visible_student_query(db, current).with_entities(User.user_id)]
    verified = Counter()
    if ids:
        verified = Counter(sid for (sid,) in db.query(StudentSkill.skill_id).filter(StudentSkill.is_verified.is_(True), StudentSkill.skill_id.in_(required.keys()), StudentSkill.student_id.in_(ids)))
    names = {s.skill_id: s.name for s in db.query(Skill).filter(Skill.skill_id.in_(required.keys()))}
    top = sorted(required, key=lambda sid: (-required[sid], names.get(sid, "")))[:10]
    return [SkillGapStat(skill=names[sid], required=required[sid], verified=verified[sid]) for sid in top]


@router.get("/analytics/unmet-demand", response_model=list[UnmetDemandStat], summary="Упущенный спрос: что ищут студенты и сколько находят")
def analytics_unmet_demand(current=Depends(get_current_user), db: Session = Depends(get_db)):
    _require_org(current)
    ids = [row.user_id for row in visible_student_query(db, current).with_entities(User.user_id)]
    if not ids:
        return []
    totals: dict[str, list[int]] = defaultdict(list)
    for row in db.query(SearchLog.skill_name, SearchLog.result_count).filter(SearchLog.student_id.in_(ids)):
        totals[row.skill_name].append(row.result_count)
    stats = [UnmetDemandStat(skill=s, searches=len(c), avg_results=round(sum(c) / len(c), 1)) for s, c in totals.items()]
    stats.sort(key=lambda s: (-s.searches, s.avg_results))
    return stats[:8]


@router.get("/analytics/funnel", response_model=FunnelOut, summary="Воронка откликов и скорость решения")
def analytics_funnel(current=Depends(get_current_user), db: Session = Depends(get_db)):
    _require_org(current)
    if current["role"] == "hr":
        apps = db.query(Application).join(Vacancy).filter(Vacancy.company_id == current["org_id"]).all()
    else:
        ids = [row.user_id for row in visible_student_query(db, current).with_entities(User.user_id)]
        apps = db.query(Application).filter(Application.student_id.in_(ids)).all() if ids else []
    out = applications_out(db, apps, viewer="company")
    hours = []
    for app in apps:
        decided = next((e for e in app.events if e.kind in ("accepted", "rejected")), None)
        if decided:
            hours.append((decided.created_at - app.created_at).total_seconds() / 3600)
    return FunnelOut(
        applications=len(out), answered=sum(1 for a in out if a.test_answer or a.test_answers), accepted=sum(1 for a in out if a.status == "accepted"),
        rejected=sum(1 for a in out if a.status == "rejected"), missed=sum(1 for a in out if a.status == "missed"),
        avg_match=round(sum(a.match_score for a in out) / len(out), 1) if out else 0.0, median_hours_to_decision=round(median(hours), 1) if hours else None,
    )


@router.get("/analytics/university", response_model=UniversityAnalyticsOut, summary="Вуз: работодатели и спрос на навыки в регионе, результаты по группам")
def analytics_university(current=Depends(get_current_user), db: Session = Depends(get_db)):
    require_role(current, "curator", detail="University analytics is available to curators")
    owner = org_owner(db, current)
    region, city = owner.region or "", owner.city or ""
    students = visible_student_query(db, current).all()
    ids = [s.user_id for s in students]
    apps = db.query(Application).filter(Application.student_id.in_(ids)).all() if ids else []
    links = db.query(StudentSkill).filter(StudentSkill.student_id.in_(ids)).all() if ids else []

    vac_query = db.query(Vacancy).filter(Vacancy.is_active.is_(True))
    regional = vac_query.filter(Vacancy.region == region).all() if region else vac_query.all()
    # Employers relevant to the university: hiring in its region or already hiring its students.
    applied_vacancy_ids = {a.vacancy_id for a in apps}
    relevant = {v.vacancy_id: v for v in regional}
    for v in db.query(Vacancy).filter(Vacancy.vacancy_id.in_(applied_vacancy_ids or {-1})):
        relevant[v.vacancy_id] = v
    requirements = load_requirements(db, list(relevant))

    employers: dict[str, EmployerStat] = {}
    for v in relevant.values():
        company = v.company
        stat = employers.setdefault(v.company_id, EmployerStat(company=company.name if company else "—", region=v.region or "", city=v.city or "", vacancies=0, applications_from_us=0, accepted_from_us=0, top_skills=[]))
        if v.is_active:
            stat.vacancies += 1
        stat.top_skills = list(dict.fromkeys(stat.top_skills + [r.name for r in requirements.get(v.vacancy_id, []) if r.is_core]))[:5]
    for a in apps:
        v = relevant.get(a.vacancy_id)
        if v:
            employers[v.company_id].applications_from_us += 1
            employers[v.company_id].accepted_from_us += a.status == "accepted"

    demand = Counter(r.name for vid in (v.vacancy_id for v in regional) for r in requirements.get(vid, []))
    verified = Counter(link.skill.name for link in links if link.is_verified)
    claimed = Counter(link.skill.name for link in links if not link.is_verified and link.status in ("claimed", "employer_review"))
    skills_demand = [SkillDemandStat(skill=s, vacancies=n, our_verified=verified[s], our_claimed=claimed[s]) for s, n in demand.most_common(12)]

    by_group: dict[str, list[User]] = defaultdict(list)
    for s in students:
        by_group[s.group or "Без группы"].append(s)
    apps_by_student = defaultdict(list)
    for a in apps:
        apps_by_student[a.student_id].append(a)
    links_by_student = defaultdict(list)
    for link in links:
        links_by_student[link.student_id].append(link)
    groups = []
    for name, members in sorted(by_group.items()):
        all_links = [l for m in members for l in links_by_student[m.user_id]]
        groups.append(GroupStat(
            group=name, students=len(members), with_applications=sum(1 for m in members if apps_by_student[m.user_id]),
            accepted=sum(1 for m in members if any(a.status == "accepted" for a in apps_by_student[m.user_id])),
            verified_share=round(sum(l.is_verified for l in all_links) / len(all_links) * 100, 1) if all_links else 0.0,
        ))
    return UniversityAnalyticsOut(
        region=region, city=city, students=len(students), groups=db.query(StudentGroup).filter(StudentGroup.org_id == owner.user_id).count(),
        verified_skills=sum(l.is_verified for l in links), to_review=sum(1 for l in links if not l.is_verified and (l.status or "claimed") == "claimed"),
        applications=len(apps), accepted=sum(a.status == "accepted" for a in apps),
        employers_in_region=len({v.company_id for v in regional}), vacancies_in_region=len(regional),
        employers=sorted(employers.values(), key=lambda e: (-e.applications_from_us, -e.vacancies, e.company)),
        skills_demand=skills_demand, by_group=groups,
    )


@router.get("/leaderboard", response_model=list[LeaderboardEntry], summary="Витрина талантов: студенты по баллам")
def leaderboard(current=Depends(get_current_user), db: Session = Depends(get_db)):
    _require_org(current)
    entries = []
    for s in visible_student_query(db, current).all():
        verified_count = db.query(StudentSkill).filter(StudentSkill.student_id == s.user_id, StudentSkill.is_verified.is_(True)).count()
        entries.append(LeaderboardEntry(student_id=s.user_id, name=s.name, university=s.university or "", points=calculate_points(db, s.user_id), verified_skills_count=verified_count, avatar_url=s.avatar_url or ""))
    entries.sort(key=lambda e: (-e.points, -e.verified_skills_count, e.name))
    return entries
