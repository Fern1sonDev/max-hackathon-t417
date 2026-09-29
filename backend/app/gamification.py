"""Student "points" for the leaderboard / "Витрина талантов" — always
computed live from existing rows (no stored points column), same philosophy
as match_score.py, so there's nothing to keep in sync or reset.
"""

from sqlalchemy.orm import Session

from app.models import Application, StudentSkill, User

_POINTS_PER_VERIFIED_SKILL = 10
_POINTS_PER_ACCEPTED_APPLICATION = 15
_POINTS_PER_APPLICATION = 2
_POINTS_PER_ANSWER = 3
_POINTS_FOR_COMPLETE_PROFILE = 5
_MAX_APPLICATIONS_REWARDED = 5
_MAX_ANSWERS_REWARDED = 5


def calculate_points(db: Session, student_id: str) -> int:
    verified_skills = (
        db.query(StudentSkill)
        .filter(StudentSkill.student_id == student_id, StudentSkill.is_verified.is_(True))
        .count()
    )
    applications = db.query(Application).filter(Application.student_id == student_id).all()
    accepted = sum(1 for a in applications if a.status == "accepted")
    answered = sum(1 for a in applications if (a.test_answer or "").strip())
    user = db.get(User, student_id)
    profile_complete = bool(user and user.university and user.group and (user.region or user.city))

    return (
        verified_skills * _POINTS_PER_VERIFIED_SKILL
        + accepted * _POINTS_PER_ACCEPTED_APPLICATION
        + min(len(applications), _MAX_APPLICATIONS_REWARDED) * _POINTS_PER_APPLICATION
        + min(answered, _MAX_ANSWERS_REWARDED) * _POINTS_PER_ANSWER
        + (_POINTS_FOR_COMPLETE_PROFILE if profile_complete else 0)
    )
