"""Skill-name normalisation and the "related skills" graph used by the match
index (see app/match_score.py).

Why this exists: skills are free-text tags typed by students, HR and
curators. Without normalisation "linux", "Linux " and "LINUX" become three
different skills, and a verified "Linux" silently fails to match a vacancy
that asks for "linux". Every comparison in the matching engine therefore goes
through `skill_key()`, and every new tag is stored under `canonical_name()`.

Families are deliberately small and conservative: a skill from the same
family is an adjacent competence (e.g. FreeBSD for a Linux requirement), not
a replacement, so it earns only partial credit in the index.
"""

import re

# alias (normalised) -> canonical display name
_ALIASES: dict[str, str] = {
    "js": "JavaScript",
    "javascript": "JavaScript",
    "ts": "TypeScript",
    "typescript": "TypeScript",
    "reactjs": "React",
    "react.js": "React",
    "vue.js": "Vue",
    "vuejs": "Vue",
    "py": "Python",
    "python3": "Python",
    "postgres": "PostgreSQL",
    "postgresql": "PostgreSQL",
    "psql": "PostgreSQL",
    "mysql": "MySQL",
    "k8s": "Kubernetes",
    "kubernetes": "Kubernetes",
    "docker": "Docker",
    "linux": "Linux",
    "freebsd": "FreeBSD",
    "zabbix": "Zabbix",
    "netbox": "NetBox",
    "proxmox": "Proxmox",
    "proxmox ve": "Proxmox",
    "vmware": "VMware",
    "mikrotik": "MikroTik",
    "cisco": "Cisco",
    "eltex": "Eltex",
    "sql": "SQL",
    "git": "Git",
    "autocad": "AutoCAD",
    "vpn": "Защищённые сетевые соединения",
    "защищенные сетевые соединения": "Защищённые сетевые соединения",
    "vlan": "VLAN / Коммутация",
    "коммутация": "VLAN / Коммутация",
    "vlan / коммутация": "VLAN / Коммутация",
}

# Families of adjacent skills. Keys are normalised (see skill_key()).
_FAMILIES: dict[str, set[str]] = {
    "unix": {"linux", "freebsd", "ubuntu", "debian", "centos", "astra linux", "red os"},
    "virtualization": {"proxmox", "vmware", "kvm", "hyper-v", "virtualbox"},
    "containers": {"docker", "kubernetes", "podman", "docker compose"},
    "monitoring": {"zabbix", "prometheus", "grafana", "nagios"},
    "network": {
        "cisco", "eltex", "mikrotik", "huawei", "vlan / коммутация", "сетевые протоколы",
        "защищенные сетевые соединения", "телеком-сеть доступа", "телеком-транспорт", "сетевые сервисы",
    },
    "frontend": {"react", "vue", "angular", "svelte"},
    "js": {"javascript", "typescript"},
    "databases": {"sql", "postgresql", "mysql", "clickhouse", "sqlite"},
    "design": {"autocad", "проектирование", "проектирование скс", "ops", "опс"},
}

_KEY_TO_FAMILY: dict[str, str] = {key: family for family, keys in _FAMILIES.items() for key in keys}

# Offered in onboarding even before any vacancy asks for them.
STARTER_SKILLS: list[str] = [
    "Linux", "Python", "SQL", "Git", "Docker", "Zabbix", "Proxmox", "NetBox", "Защищённые сетевые соединения",
    "Cisco", "MikroTik", "Eltex", "VLAN / Коммутация", "React", "TypeScript", "JavaScript", "PostgreSQL", "AutoCAD",
]


def _basic(name: str) -> str:
    value = (name or "").strip().lower().replace("ё", "е")
    value = re.sub(r"\s+", " ", value)
    return value.strip(" .,;")


def canonical_name(name: str) -> str:
    """The display name a new tag should be stored under."""
    cleaned = re.sub(r"\s+", " ", (name or "").strip()).strip(" .,;")
    return _ALIASES.get(_basic(cleaned), cleaned)


def skill_key(name: str) -> str:
    """Comparison key: case/ё/whitespace-insensitive and alias-aware."""
    return _basic(canonical_name(name))


def family_of(name: str) -> str | None:
    return _KEY_TO_FAMILY.get(skill_key(name))
