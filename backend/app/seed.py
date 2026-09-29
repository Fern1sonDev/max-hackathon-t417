"""Demo data for the jury check. Everything here is fictional: organisations,
people, phones and e-mails (the .example domain); all ids start with `demo-`.

Two universities (СКФУ, КубГТУ) with an administrator and curators, two
companies with an HR director and a recruiter, four academic groups with
invite links, six students with reviewed skills, seven internships and
applications in every pipeline stage.

`ensure_demo_data()` is idempotent and additive: it creates only what is
missing and never touches non-demo rows (ENABLE_DEMO_DATA=true runs it at
startup).

    python -m app.seed                 # ensure demo data exists
    python -m app.seed --refresh-demo  # return demo students/applications to their initial state
    python -m app.seed --purge-demo    # delete all demo-* rows (real users untouched)
"""

import datetime
import json
import sys

from sqlalchemy import delete, insert
from sqlalchemy.orm import Session

from app.auth import hash_password, verify_password
from app.config import settings
from app.database import Base, SessionLocal, engine
from app.models import (
    Application,
    ApplicationEvent,
    NotifiedMatch,
    OrgInvite,
    OutboxMessage,
    PassiveNudge,
    SearchLog,
    Skill,
    SkillTest,
    StudentGroup,
    StudentSkill,
    TestAttempt,
    TestQuestion,
    User,
    Vacancy,
    vacancy_required_skills,
)
from app.skills_catalog import STARTER_SKILLS

DEMO_PASSWORD = "demo12345"
UNIVERSITY = "СКФУ (Северо-Кавказский федеральный университет)"
UNIVERSITY_2 = "КубГТУ (Кубанский государственный технологический университет)"

# Organisation owners (their logins are published in the README and on slide 1).
ORGS = [
    {"user_id": "demo-curator-1", "role": "curator", "name": "Анна Ковалева", "position": "Руководитель центра карьеры", "email": "curator@skfu.example",
     "contact_info": "curator@skfu.example", "phone": "+7 900 100-00-01", "university": UNIVERSITY, "region": "Ставропольский край", "city": "Ставрополь", "directory_opt_in": True},
    {"user_id": "demo-curator-2", "role": "curator", "name": "Дмитрий Волков", "position": "Руководитель практики", "email": "curator@kubstu.example",
     "contact_info": "curator@kubstu.example", "phone": "+7 900 100-00-02", "university": UNIVERSITY_2, "region": "Краснодарский край", "city": "Краснодар", "directory_opt_in": True},
    {"user_id": "demo-hr-1", "role": "hr", "name": "ИнтерТех Интегратор", "person_name": "Елена Смирнова", "position": "HR-директор", "email": "hr@intertech.example",
     "contact_info": "hr@intertech.example", "phone": "+7 900 200-00-01", "region": "Ставропольский край", "city": "Ставрополь"},
    {"user_id": "demo-hr-2", "role": "hr", "name": "ЮгТелекомSoft", "person_name": "Сергей Литвинов", "position": "Владелец компании", "email": "hr@yugtelecomsoft.example",
     "contact_info": "hr@yugtelecomsoft.example", "phone": "+7 900 200-00-02", "region": "Краснодарский край", "city": "Краснодар"},
]

# Staff invited into the workspaces above.
MEMBERS = [
    {"user_id": "demo-curator-3", "role": "curator", "name": "Игорь Белов", "position": "Куратор практики, ИВТ-21-2", "email": "curator2@skfu.example",
     "org_owner_id": "demo-curator-1", "university": UNIVERSITY, "region": "Ставропольский край", "city": "Ставрополь"},
    {"user_id": "demo-hr-3", "role": "hr", "name": "Ольга Руденко", "position": "Рекрутер", "email": "recruiter@intertech.example",
     "org_owner_id": "demo-hr-1", "region": "Ставропольский край", "city": "Ставрополь"},
]

GROUPS = [
    {"code": "skfuIVT211", "org_id": "demo-curator-1", "university": UNIVERSITY, "name": "ИВТ-21-1", "course": 3, "specialty": "Информатика и вычислительная техника", "region": "Ставропольский край", "city": "Ставрополь", "curator_id": "demo-curator-1"},
    {"code": "skfuIVT212", "org_id": "demo-curator-1", "university": UNIVERSITY, "name": "ИВТ-21-2", "course": 3, "specialty": "Информатика и вычислительная техника", "region": "Ставропольский край", "city": "Невинномысск", "curator_id": "demo-curator-3"},
    {"code": "kubPI22100", "org_id": "demo-curator-2", "university": UNIVERSITY_2, "name": "ПИ-22-1", "course": 2, "specialty": "Прикладная информатика", "region": "Краснодарский край", "city": "Краснодар", "curator_id": "demo-curator-2"},
    {"code": "kubIVT2230", "org_id": "demo-curator-2", "university": UNIVERSITY_2, "name": "ИВТ-22-3", "course": 2, "specialty": "Информатика и вычислительная техника", "region": "Ростовская область", "city": "Ростов-на-Дону", "curator_id": "demo-curator-2"},
]

STUDENTS = [
    {"user_id": "demo-student-1", "name": "Иван Петров", "contact_info": "@ivan_petrov", "phone": "+7 900 300-00-01", "university": UNIVERSITY, "group": "ИВТ-21-1", "region": "Ставропольский край", "city": "Ставрополь", "student_directory_opt_in": True},
    {"user_id": "demo-student-2", "name": "Мария Сидорова", "contact_info": "@masha_s", "phone": "+7 900 300-00-02", "university": UNIVERSITY, "group": "ИВТ-21-1", "region": "Ставропольский край", "city": "Ставрополь", "student_directory_opt_in": True},
    {"user_id": "demo-student-3", "name": "Пётр Кузнецов", "contact_info": "@petr_k", "phone": "+7 900 300-00-03", "university": UNIVERSITY, "group": "ИВТ-21-2", "region": "Ставропольский край", "city": "Невинномысск"},
    {"user_id": "demo-student-4", "name": "Ольга Быкова", "contact_info": "@olga_bykova", "phone": "+7 900 300-00-04", "university": UNIVERSITY_2, "group": "ПИ-22-1", "region": "Краснодарский край", "city": "Краснодар", "student_directory_opt_in": True},
    {"user_id": "demo-student-5", "name": "Артём Соколов", "contact_info": "@artem_sokolov", "phone": "+7 900 300-00-05", "university": UNIVERSITY_2, "group": "ПИ-22-1", "region": "Краснодарский край", "city": "Краснодар"},
    {"user_id": "demo-student-6", "name": "Ксения Морозова", "contact_info": "@ksenia_morozova", "phone": "+7 900 300-00-06", "university": UNIVERSITY_2, "group": "ИВТ-22-3", "region": "Ростовская область", "city": "Ростов-на-Дону"},
]
GROUP_OF = {"demo-student-1": "skfuIVT211", "demo-student-2": "skfuIVT211", "demo-student-3": "skfuIVT212", "demo-student-4": "kubPI22100", "demo-student-5": "kubPI22100", "demo-student-6": "kubIVT2230"}

VACANCIES = [
    {"title": "Стажёр по сетевой инфраструктуре", "company_id": "demo-hr-1", "region": "Ставропольский край", "city": "Ставрополь",
     "description": "Настройка и обслуживание корпоративной сети: защищённые соединения, мониторинг, документирование инфраструктуры в NetBox. Наставник — ведущий сетевой инженер, 20 ч в неделю, возможен переход в штат.",
     "questions": ["Пользователь сообщает, что защищённое соединение установлено, но внутренний ресурс недоступен. Какие три проверки вы выполните в первую очередь?",
                   "Как вы задокументируете новую площадку в NetBox, чтобы коллега через год быстро в ней разобрался?"],
     "core": ["Linux", "Защищённые сетевые соединения", "NetBox", "Zabbix", "Proxmox"], "optional": []},
    {"title": "Стажер-администратор", "company_id": "demo-hr-1", "region": "Ставропольский край", "city": "Невинномысск",
     "description": "Поддержка систем мониторинга и виртуализации на стороне заказчика. Гибкий график, подходит для совмещения с учёбой.",
     "questions": ["Какие метрики вы добавили бы в мониторинг Linux-сервера?", "Как настроить уведомление о нехватке места на диске, чтобы оно не будило дежурного из-за временных всплесков?"],
     "core": ["Linux", "Zabbix", "Proxmox"], "optional": []},
    {"title": "Frontend-стажёр", "company_id": "demo-hr-2", "region": "Краснодарский край", "city": "Краснодар",
     "description": "Разработка интерфейсов для внутренних сервисов на React + TypeScript, интеграция с REST API. Код-ревью от senior-разработчика.",
     "questions": ["Как в React вы покажете состояние загрузки, пустой список и ошибку при запросе к API?", "Как типизировать ответ API в TypeScript, если сервер может вернуть поле null?"],
     "core": ["React", "TypeScript"], "optional": ["Docker"]},
    {"title": "DevOps-стажёр", "company_id": "demo-hr-2", "region": "Ростовская область", "city": "Ростов-на-Дону",
     "description": "Контейнеризация сервисов, поддержка CI и баз данных для регионального облачного провайдера.",
     "questions": ["Как вы уменьшите размер Docker-образа Python-сервиса и безопасно передадите ему секреты для подключения к БД?"],
     "core": ["Docker", "SQL", "Linux"], "optional": []},
    {"title": "Практикант в отдел телекоммуникаций", "company_id": "demo-hr-2", "region": "Краснодарский край", "city": "Краснодар",
     "description": "Пусконаладка сетевого оборудования, настройка коммутаторов и маршрутизаторов, подготовка конфигураций для объектов связи. Производственная практика 4 недели, полный день.",
     "questions": ["На коммутаторе нужно разделить бухгалтерию и гостевой Wi-Fi. Как вы это сделаете?", "Как проверите, что сегменты действительно изолированы?"],
     "core": ["Cisco", "VLAN / Коммутация"], "optional": ["Eltex", "Linux"]},
    {"title": "Стажёр-аналитик данных", "company_id": "demo-hr-1", "region": "Ставропольский край", "city": "Ставрополь",
     "description": "Отчёты по качеству сети и обращениям клиентов: выгрузки из PostgreSQL, обработка в Python, дашборды для руководителей.",
     "questions": ["Есть таблица обращений (дата, район, тип проблемы). Каким SQL-запросом вы найдёте три района с наибольшим ростом обращений за месяц?"],
     "core": ["Python", "SQL"], "optional": ["PostgreSQL", "Git"]},
    {"title": "Стажёр по автоматизации сетей", "company_id": "demo-hr-1", "region": "Ставропольский край", "city": "Ставрополь",
     "description": "Скрипты на Python для инвентаризации и резервного копирования конфигураций, интеграция с NetBox.",
     "questions": ["Как бы вы автоматически собирали конфигурации 50 коммутаторов раз в сутки и где хранили бы историю изменений?"],
     "core": ["Python", "Linux"], "optional": ["NetBox", "Git"]},
]

# student_id -> {skill: (status, comment)}
STUDENT_SKILLS = {
    "demo-student-1": {"Linux": ("verified", "Лабораторные по администрированию — «отлично»"), "Защищённые сетевые соединения": ("verified", "Курсовой проект: VPN для филиала"),
                       "NetBox": ("verified", ""), "Zabbix": ("verified", "Учебный стенд кафедры"), "Proxmox": ("verified", ""), "Python": ("claimed", "")},
    "demo-student-2": {"Linux": ("verified", ""), "Защищённые сетевые соединения": ("verified", "Участие в хакатоне кафедры"), "Zabbix": ("verified", ""),
                       "NetBox": ("claimed", ""), "Proxmox": ("claimed", "")},
    "demo-student-3": {"Linux": ("verified", ""), "Zabbix": ("claimed", ""), "Python": ("employer_review", "Пишет скрипты в студклубе, в учебном плане курса нет"),
                       "FreeBSD": ("rejected", "Не изучалось на курсе — подтвердить нечем")},
    "demo-student-4": {"SQL": ("verified", ""), "Docker": ("claimed", ""), "React": ("claimed", ""), "TypeScript": ("verified", "Командный проект на хакатоне кафедры")},
    "demo-student-5": {"SQL": ("verified", ""), "Python": ("verified", "Курсовая по анализу данных"), "Docker": ("employer_review", "Pet-проекты, академически не проверялось"), "Git": ("verified", "")},
    "demo-student-6": {"Docker": ("claimed", ""), "TypeScript": ("claimed", ""), "Linux": ("verified", ""), "Cisco": ("verified", "Сертификат сетевой академии вуза")},
}

NEXT_STEP = {
    "format": "online", "datetime": "в ближайший четверг, 11:00", "place": "Ссылку на видеовстречу пришлём за час",
    "contact_name": "Елена Смирнова, HR-директор", "contact_phone": "+7 900 200-00-01",
    "message": "Будет 30 минут: разберём ваш SQL-запрос и расскажем про задачи отдела. Возьмите ноутбук — попросим показать курсовую.",
}

# (student, vacancy title, status, answers, hours ago, next step)
APPLICATIONS = [
    ("demo-student-1", "Стажёр по сетевой инфраструктуре", "pending",
     ["1) Маршрут до подсети ресурса (ip route, traceroute). 2) Правила межсетевого экрана и NAT на шлюзе. 3) DNS: резолвится ли внутреннее имя через туннель.",
      "Создам Site и Location, стойки, устройства с интерфейсами и кабелями, префиксы и VLAN в IPAM, а в описании площадки — контакты и схему."], 20, None),
    ("demo-student-2", "Стажёр по сетевой инфраструктуре", "pending", [], 30, None),
    ("demo-student-3", "Стажер-администратор", "pending", [], 10, None),
    ("demo-student-4", "Frontend-стажёр", "pending",
     ["Три состояния в одном компоненте: isLoading → скелетон, пустой массив → заглушка с действием, error → сообщение и кнопка «Повторить».", "Тип ответа с полем `field: string | null` и явная проверка перед использованием."], 6, None),
    ("demo-student-6", "DevOps-стажёр", "pending", [], 4, None),
    ("demo-student-5", "Стажёр-аналитик данных", "accepted", ["Сравню число обращений по районам за текущий и прошлый месяц через оконную функцию lag() и выберу три с наибольшим приростом."], 50, NEXT_STEP),
    ("demo-student-2", "Стажер-администратор", "missed", [], 80, None),
    ("demo-student-1", "Стажёр по автоматизации сетей", "rejected", ["Скрипт на Python с Netmiko по расписанию, конфигурации — в Git, diff при изменениях."], 60, None),
]

TESTS = [
    ("NetBox: документирование сети", "NetBox", UNIVERSITY, "demo-curator-1", "demo-hr-1", "published", 80,
     "Совместный тест кафедры и «ИнтерТех Интегратор»: 5 вопросов, нужно 80%. Успешная сдача подтверждает навык NetBox от имени вуза.",
     [
         ("Для чего в первую очередь используют NetBox?", ["Мониторинг загрузки каналов в реальном времени", "Документирование инфраструктуры: IPAM и DCIM — адреса, стойки, устройства, кабели", "Резервное копирование конфигураций", "Управление учётными записями пользователей"], 1),
         ("Что означает IPAM?", ["IP Address Management — учёт IP-адресов, префиксов и VLAN", "Internet Protocol Access Monitor", "Integrated Port Allocation Module", "IP Accounting and Metering"], 0),
         ("Как в NetBox отразить физическое соединение двух устройств?", ["Добавить одинаковый тег обоим устройствам", "Разместить их на одной площадке (Site)", "Создать кабель (Cable) между их интерфейсами", "Никак — NetBox не хранит физические связи"], 2),
         ("Как внешние скрипты обычно получают данные из NetBox?", ["Только через выгрузку в Excel", "Через SNMP-опрос сервера NetBox", "Чтением файлов конфигурации устройств", "Через REST API (и GraphQL в новых версиях)"], 3),
         ("В какой сущности NetBox хранят сеть 10.10.0.0/24?", ["Device", "Prefix", "Rack", "Tenant group"], 1),
     ]),
    ("Proxmox VE: основы виртуализации", "Proxmox", UNIVERSITY, "demo-curator-1", "demo-hr-1", "published", 75,
     "4 вопроса по практике виртуализации, нужно 75%. Составлен кафедрой вместе с инженерами «ИнтерТех Интегратор».",
     [
         ("Какие типы гостевых систем поддерживает Proxmox VE?", ["Только контейнеры Docker", "Только виртуальные машины Hyper-V", "Виртуальные машины KVM и контейнеры LXC", "Виртуальные машины ESXi"], 2),
         ("Чем снапшот отличается от резервной копии (vzdump)?", ["Снапшот хранится рядом с диском ВМ и не спасает при потере хранилища, бэкап — отдельный архив", "Ничем, это синонимы", "Бэкап нельзя восстановить на другом узле", "Снапшоты доступны только для контейнеров"], 0),
         ("Что нужно для живой миграции ВМ между узлами без простоя?", ["Выключить ВМ перед переносом", "Кластер Proxmox и общее или реплицируемое хранилище диска ВМ", "Отдельная лицензия на каждый узел", "Docker Swarm"], 1),
         ("На каком порту по умолчанию работает веб-интерфейс Proxmox VE?", ["80 (HTTP)", "443", "3389", "8006 (HTTPS)"], 3),
     ]),
    ("React: состояния интерфейса", "React", UNIVERSITY_2, "demo-hr-2", "demo-hr-2", "pending", 70,
     "Предложение компании «ЮгТелекомSoft» для КубГТУ — ждёт публикации куратором вуза.",
     [
         ("Где запрашивать данные с API в функциональном компоненте?", ["В useEffect", "Прямо в теле рендера", "В обработчике CSS", "В атрибуте key"], 0),
         ("Зачем элементам списка атрибут key?", ["Для стилизации", "Чтобы React сопоставлял элементы между рендерами", "Для SEO", "Чтобы избежать CORS"], 1),
         ("Как правильно показать ошибку загрузки?", ["Вызвать alert() во время рендера", "Перезагрузить страницу", "Хранить ошибку в состоянии и показать сообщение с кнопкой «Повторить»", "Ничего не показывать"], 2),
     ]),
]


def _now() -> datetime.datetime:
    return datetime.datetime.utcnow()


def _consent() -> dict:
    now = _now()
    return {"terms_accepted_at": now, "terms_version": settings.terms_version, "privacy_accepted_at": now, "privacy_version": settings.privacy_version}


def ensure_starter_skills(db: Session) -> None:
    existing = {s.name.lower() for s in db.query(Skill.name)}
    for name in STARTER_SKILLS:
        if name.lower() not in existing:
            db.add(Skill(name=name))
    db.commit()


def _skill(db: Session, name: str) -> Skill:
    skill = db.query(Skill).filter(Skill.name == name).first()
    if not skill:
        skill = Skill(name=name)
        db.add(skill)
        db.flush()
    return skill


def _ensure_staff(db: Session, data: dict) -> None:
    user = db.get(User, data["user_id"])
    if not user:
        db.add(User(**data, password_hash=hash_password(DEMO_PASSWORD), **_consent()))
        return
    if not user.password_hash or not verify_password(DEMO_PASSWORD, user.password_hash):
        user.password_hash = hash_password(DEMO_PASSWORD)  # published test credentials must keep working
    for key in ("position", "phone", "person_name", "org_owner_id", "region", "city"):
        if key in data and not getattr(user, key):
            setattr(user, key, data[key])
    if user.terms_version != settings.terms_version or user.privacy_version != settings.privacy_version:
        for key, value in _consent().items():
            setattr(user, key, value)


def _apply_skills(db: Session, student_id: str, now: datetime.datetime) -> None:
    university_of = {s["user_id"]: s["university"] for s in STUDENTS}
    reviewer = "demo-curator-1" if university_of[student_id] == UNIVERSITY else "demo-curator-2"
    for name, (status, comment) in STUDENT_SKILLS[student_id].items():
        reviewed = status != "claimed"
        db.add(StudentSkill(
            student_id=student_id, skill_id=_skill(db, name).skill_id, is_verified=status == "verified", status=status, comment=comment,
            verified_by=reviewer if reviewed else None, verified_at=now if reviewed else None,
        ))


def _seed_events(db: Session, app: Application, created: datetime.datetime) -> None:
    db.add(ApplicationEvent(app_id=app.app_id, kind="created", note="Отклик отправлен работодателю", created_at=created))
    if app.test_answer:
        db.add(ApplicationEvent(app_id=app.app_id, kind="answered", note="Ответ на задание отправлен", created_at=created + datetime.timedelta(hours=1)))
    if app.status in ("accepted", "rejected"):
        db.add(ApplicationEvent(app_id=app.app_id, kind=app.status, note="Приглашение на следующий этап" if app.status == "accepted" else "Отказ", created_at=created + datetime.timedelta(hours=26)))
    if app.status == "missed":
        db.add(ApplicationEvent(app_id=app.app_id, kind="missed", note="Работодатель не ответил за 72 ч — отклик снят автоматически", created_at=created + datetime.timedelta(hours=72)))


def _fill_application(app: Application, status: str, answers: list[str], created: datetime.datetime, step: dict | None) -> None:
    app.status, app.created_at, app.updated_at = status, created, created
    app.test_answers = json.dumps(answers, ensure_ascii=False) if answers else ""
    app.test_answer = answers[0] if len(answers) == 1 else "\n\n".join(f"{i}. {a}" for i, a in enumerate(answers, 1))
    app.next_step = json.dumps(step, ensure_ascii=False) if step else ""
    app.previous_status, app.decision_visible_at = "", None


def ensure_demo_data(db: Session) -> None:
    now = _now()
    for org in ORGS:
        _ensure_staff(db, org)
    db.commit()
    for member in MEMBERS:
        _ensure_staff(db, member)
    db.commit()

    groups: dict[str, StudentGroup] = {}
    for g in GROUPS:
        group = db.query(StudentGroup).filter(StudentGroup.invite_code == g["code"]).first()
        if not group:
            group = StudentGroup(**{k: v for k, v in g.items() if k != "code"}, invite_code=g["code"])
            db.add(group)
            db.flush()
        groups[g["code"]] = group

    for data in STUDENTS:
        user = db.get(User, data["user_id"])
        group = groups[GROUP_OF[data["user_id"]]]
        if not user:
            db.add(User(role="student", group_id=group.group_id, **data, **_consent()))
        elif user.role == "student":
            if not user.group_id:
                user.group_id = group.group_id
            if not user.phone:
                user.phone = data["phone"]
            if user.terms_version != settings.terms_version or user.privacy_version != settings.privacy_version:
                for key, value in _consent().items():
                    setattr(user, key, value)
    db.commit()

    vacancies: dict[str, Vacancy] = {}
    for v in VACANCIES:
        vacancy = db.query(Vacancy).filter(Vacancy.company_id == v["company_id"], Vacancy.title == v["title"]).first()
        text = v["questions"][0] if len(v["questions"]) == 1 else "\n".join(f"{i}. {q}" for i, q in enumerate(v["questions"], 1))
        if not vacancy:
            vacancy = Vacancy(company_id=v["company_id"], title=v["title"], description=v["description"], region=v["region"], city=v["city"])
            db.add(vacancy)
            db.flush()
            rows = [{"vacancy_id": vacancy.vacancy_id, "skill_id": _skill(db, n).skill_id, "is_core": True} for n in v["core"]]
            rows += [{"vacancy_id": vacancy.vacancy_id, "skill_id": _skill(db, n).skill_id, "is_core": False} for n in v["optional"]]
            db.execute(insert(vacancy_required_skills), rows)
        if not vacancy.test_questions:
            vacancy.test_questions = json.dumps(v["questions"], ensure_ascii=False)
            vacancy.test_task = text
        vacancies[v["title"]] = vacancy
    db.commit()

    for student_id in STUDENT_SKILLS:
        if not db.query(StudentSkill).filter(StudentSkill.student_id == student_id).first():
            _apply_skills(db, student_id, now)
    db.commit()

    for student_id, title, status, answers, hours_ago, step in APPLICATIONS:
        vacancy = vacancies[title]
        if db.query(Application).filter(Application.student_id == student_id, Application.vacancy_id == vacancy.vacancy_id).first():
            continue
        created = now - datetime.timedelta(hours=hours_ago)
        app = Application(student_id=student_id, vacancy_id=vacancy.vacancy_id)
        _fill_application(app, status, answers, created, step)
        db.add(app)
        db.flush()
        _seed_events(db, app, created)
    db.commit()
    ensure_demo_tests(db)


def ensure_demo_tests(db: Session) -> None:
    for title, skill, university, author, partner, status, pass_score, description, questions in TESTS:
        if db.query(SkillTest).filter(SkillTest.title == title, SkillTest.author_id == author).first():
            continue
        test = SkillTest(
            title=title, description=description, skill_id=_skill(db, skill).skill_id, university=university, author_id=author,
            partner_company_id=partner, status=status, approved_by=author if status == "published" else None, pass_score=pass_score,
        )
        db.add(test)
        db.flush()
        for i, (text, options, correct) in enumerate(questions):
            db.add(TestQuestion(test_id=test.test_id, position=i, text=text, options=json.dumps(options, ensure_ascii=False), correct_index=correct))
    db.commit()


def refresh_demo(db: Session) -> None:
    """Return demo students and applications to their seeded state: skill
    reviews, test attempts, group membership, statuses, answers and timelines."""
    now = _now()
    demo_students = [s["user_id"] for s in STUDENTS]
    db.query(TestAttempt).filter(TestAttempt.student_id.in_(demo_students)).delete(synchronize_session=False)
    db.query(StudentSkill).filter(StudentSkill.student_id.in_(demo_students)).delete(synchronize_session=False)
    for student_id in demo_students:
        _apply_skills(db, student_id, now)
    groups = {g.invite_code: g for g in db.query(StudentGroup).filter(StudentGroup.invite_code.in_(GROUP_OF.values()))}
    for data in STUDENTS:
        user = db.get(User, data["user_id"])
        group = groups.get(GROUP_OF[data["user_id"]])
        if user and group:
            user.group_id, user.group, user.university = group.group_id, group.name, group.university
    titles = {v["title"]: v["company_id"] for v in VACANCIES}
    for student_id, title, status, answers, hours_ago, step in APPLICATIONS:
        vacancy = db.query(Vacancy).filter(Vacancy.company_id == titles[title], Vacancy.title == title).first()
        app = vacancy and db.query(Application).filter(Application.student_id == student_id, Application.vacancy_id == vacancy.vacancy_id).first()
        if not app:
            continue
        created = now - datetime.timedelta(hours=hours_ago)
        db.query(OutboxMessage).filter(OutboxMessage.app_id == app.app_id, OutboxMessage.sent_at.is_(None)).delete(synchronize_session=False)
        _fill_application(app, status, answers, created, step)
        db.execute(delete(ApplicationEvent).where(ApplicationEvent.app_id == app.app_id))
        db.flush()
        _seed_events(db, app, created)
    db.commit()


def purge_demo(db: Session) -> None:
    demo_users = [row[0] for row in db.query(User.user_id).filter(User.user_id.like("demo-%"))]
    demo_vacancies = [row[0] for row in db.query(Vacancy.vacancy_id).filter(Vacancy.company_id.like("demo-%"))]
    for app in db.query(Application).filter(Application.student_id.in_(demo_users) | Application.vacancy_id.in_(demo_vacancies)).all():
        db.delete(app)
    for model in (NotifiedMatch, PassiveNudge, SearchLog, TestAttempt, StudentSkill):
        db.query(model).filter(model.student_id.in_(demo_users)).delete(synchronize_session=False)
    db.query(NotifiedMatch).filter(NotifiedMatch.vacancy_id.in_(demo_vacancies)).delete(synchronize_session=False)
    db.query(StudentSkill).filter(StudentSkill.verified_by.in_(demo_users)).update({"verified_by": None}, synchronize_session=False)
    for test in db.query(SkillTest).filter(SkillTest.author_id.in_(demo_users)).all():
        db.delete(test)
    db.query(SkillTest).filter(SkillTest.partner_company_id.in_(demo_users)).update({"partner_company_id": None}, synchronize_session=False)
    db.query(StudentGroup).filter(StudentGroup.org_id.in_(demo_users)).delete(synchronize_session=False)
    db.query(OrgInvite).filter(OrgInvite.org_owner_id.in_(demo_users)).delete(synchronize_session=False)
    db.execute(delete(vacancy_required_skills).where(vacancy_required_skills.c.vacancy_id.in_(demo_vacancies)))
    db.query(Vacancy).filter(Vacancy.vacancy_id.in_(demo_vacancies)).delete(synchronize_session=False)
    db.query(User).filter(User.user_id.in_(demo_users)).delete(synchronize_session=False)
    db.commit()


if __name__ == "__main__":
    Base.metadata.create_all(bind=engine)
    session = SessionLocal()
    try:
        if "--purge-demo" in sys.argv:
            purge_demo(session)
            print("Demo data removed (demo-* rows only).")
        else:
            ensure_starter_skills(session)
            ensure_demo_data(session)
            if "--refresh-demo" in sys.argv:
                refresh_demo(session)
                print("Demo students and applications refreshed.")
            print("Demo data is in place. Logins (password demo12345):")
            for org in ORGS + MEMBERS:
                print(f"  {org['role']:8} {org['email']}")
    finally:
        session.close()
