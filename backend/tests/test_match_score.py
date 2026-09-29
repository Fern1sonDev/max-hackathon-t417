from app.match_score import Requirement, SkillSets, compute_match
from app.skills_catalog import canonical_name, skill_key

NETWORK = [Requirement(n) for n in ["Linux", "Защищённые сетевые соединения", "NetBox", "Zabbix", "Proxmox"]]


def test_all_verified_is_100():
    skills = SkillSets(verified=["Linux", "Защищённые сетевые соединения", "NetBox", "Zabbix", "Proxmox"])
    result = compute_match(skills, NETWORK)
    assert result.score == result.verified_score == result.potential == 100.0
    assert result.missing == []


def test_claimed_skills_count_half_and_verified_share_is_separate():
    skills = SkillSets(verified=["Linux", "Защищённые сетевые соединения", "Zabbix"], claimed=["NetBox", "Proxmox"])
    result = compute_match(skills, NETWORK)
    assert result.score == 80.0  # 3 × 1 + 2 × 0.5 of 5 equal requirements
    assert result.verified_score == 60.0
    assert result.potential == 100.0
    assert [i.status for i in result.items if i.skill in ("NetBox", "Proxmox")] == ["claimed", "claimed"]


def test_only_claimed_skills_give_half_and_verified_share_zero():
    result = compute_match(SkillSets(claimed=["Linux", "Zabbix", "NetBox", "Proxmox", "Защищённые сетевые соединения"]), NETWORK)
    assert result.score == 50.0 and result.verified_score == 0.0 and result.potential == 100.0


def test_employer_review_counts_three_quarters():
    result = compute_match(SkillSets(employer=["Linux"]), [Requirement("Linux")])
    assert result.score == 75.0 and result.items[0].status == "employer"


def test_rejected_skill_is_not_counted():
    # rejected skills are not passed in SkillSets at all
    assert compute_match(SkillSets(), [Requirement("Linux")]).score == 0.0


def test_core_requirements_weigh_twice_as_much():
    reqs = [Requirement("Python", True), Requirement("SQL", True), Requirement("Git", False)]
    only_optional = compute_match(SkillSets(verified=["Git"]), reqs)
    only_core = compute_match(SkillSets(verified=["Python"]), reqs)
    assert only_optional.score == 20.0  # 1 / 5
    assert only_core.score == 40.0  # 2 / 5
    assert "SQL" in only_core.missing_core


def test_related_skill_gives_half_credit_and_names_the_source():
    result = compute_match(SkillSets(verified=["FreeBSD"]), [Requirement("Linux")])
    assert result.score == 50.0 and result.verified_score == 50.0
    assert result.items[0].status == "related" and result.items[0].via == "FreeBSD"
    claimed_related = compute_match(SkillSets(claimed=["FreeBSD"]), [Requirement("Linux")])
    assert claimed_related.score == 25.0 and claimed_related.verified_score == 0.0


def test_names_are_matched_case_and_alias_insensitively():
    reqs = [Requirement("PostgreSQL"), Requirement("JavaScript"), Requirement("Защищённые сетевые соединения")]
    result = compute_match(SkillSets(verified=["postgres", "JS", "защищенные  сетевые соединения"]), reqs)
    assert result.score == 100.0


def test_no_requirements_and_duplicates():
    assert compute_match(SkillSets(verified=["Linux"]), []).score == 0.0
    result = compute_match(SkillSets(verified=["Linux"]), [Requirement("Linux"), Requirement("linux ")])
    assert len(result.items) == 1 and result.score == 100.0


def test_canonical_names():
    assert canonical_name("  react.js ") == "React"
    assert canonical_name("Сварка ВОЛС") == "Сварка ВОЛС"
    assert skill_key("Ёлка") == skill_key("елка")
