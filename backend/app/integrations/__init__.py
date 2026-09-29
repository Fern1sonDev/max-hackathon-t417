"""External systems ПрактикаПлюс is designed to connect to.

MVP status: every connector below is *specified* — registry entry, settings
schema, data mapping and target API endpoints (see connectors.py) — and an
organisation can register a connection in the cabinet. Data exchange itself
is switched on per connector at the pilot stage, after agreeing access with
the system owner; until then connectors raise NotImplementedError and the
cabinet shows the connection as «ожидает запуска на пилоте».

All listed systems publish their APIs openly (links in `docs`).
"""

from dataclasses import dataclass, field


@dataclass(frozen=True)
class Field:
    key: str
    label: str
    placeholder: str = ""
    secret: bool = False
    required: bool = True


@dataclass(frozen=True)
class ConnectorSpec:
    id: str
    name: str
    vendor: str
    category: str  # ats | jobboard | lms | erp | gov
    roles: tuple[str, ...]  # who can connect it: hr / curator
    summary: str
    capabilities: tuple[str, ...]
    auth: str
    docs: str
    fields: tuple[Field, ...] = field(default_factory=tuple)


CONNECTORS: tuple[ConnectorSpec, ...] = (
    ConnectorSpec(
        id="huntflow", name="Хантфлоу", vendor="Huntflow", category="ats", roles=("hr",),
        summary="ATS для подбора: кандидаты из ПрактикаПлюс попадают в воронку вакансии вместе с индексом и ответом на задание.",
        capabilities=("Экспорт откликнувшихся кандидатов в вакансию", "Индекс соответствия и ответ на задание — в анкету", "Статус из Хантфлоу → статус отклика и уведомление в MAX (вебхук)"),
        auth="API-токен (Bearer)", docs="https://api.huntflow.ru/latest/docs",
        fields=(Field("account_id", "ID организации в Хантфлоу", "12345"), Field("token", "API-токен", "из Настройки → API", secret=True)),
    ),
    ConnectorSpec(
        id="potok", name="Поток Рекрутмент", vendor="Potok", category="ats", roles=("hr",),
        summary="ATS «Поток»: отклики и кандидаты синхронизируются через открытое API и вебхуки.",
        capabilities=("Создание кандидата и отклика на вакансию", "Передача навыков, подтверждённых вузом", "Вебхук смены этапа → уведомление студенту"),
        auth="API-токен", docs="https://potok.io/features/otkrytoe-api-potok/",
        fields=(Field("base_url", "Адрес аккаунта", "https://app.potok.io"), Field("token", "API-токен", secret=True)),
    ),
    ConnectorSpec(
        id="hh", name="hh.ru", vendor="HeadHunter", category="jobboard", roles=("hr",),
        summary="Импорт стажировок работодателя с hh.ru в ленту студентов с проверкой навыков.",
        capabilities=("Импорт активных вакансий-стажировок компании", "Ключевые навыки вакансии → требования индекса", "Ссылка на исходную вакансию"),
        auth="OAuth 2.0 (приложение работодателя)", docs="https://api.hh.ru/openapi/redoc",
        fields=(Field("employer_id", "ID работодателя на hh.ru", "1455"), Field("client_id", "Client ID приложения"), Field("client_secret", "Client Secret", secret=True)),
    ),
    ConnectorSpec(
        id="superjob", name="SuperJob", vendor="SuperJob", category="jobboard", roles=("hr",),
        summary="Импорт вакансий для студентов и молодых специалистов из кабинета работодателя SuperJob.",
        capabilities=("Импорт вакансий компании", "Соотнесение требований с каталогом навыков"),
        auth="OAuth 2.0 / секретный ключ приложения", docs="https://api.superjob.ru/",
        fields=(Field("client_id", "ID приложения"), Field("secret_key", "Секретный ключ", secret=True)),
    ),
    ConnectorSpec(
        id="trudvsem", name="Работа России", vendor="Роструд", category="gov", roles=("hr", "curator"),
        summary="Открытые данные портала «Работа России»: стажировки работодателя по ИНН и спрос на навыки по региону.",
        capabilities=("Импорт вакансий компании по ИНН", "Региональная аналитика спроса для вуза", "Без авторизации — открытое API"),
        auth="не требуется (открытые данные)", docs="https://trudvsem.ru/opendata/api",
        fields=(Field("inn", "ИНН работодателя или код региона", "2634000000"),),
    ),
    ConnectorSpec(
        id="moodle", name="Moodle (ЭИОС вуза)", vendor="Moodle", category="lms", roles=("curator",),
        summary="Электронная образовательная среда: освоенные компетенции и оценки из курсов становятся подтверждёнными навыками.",
        capabilities=("Импорт компетенций студента (core_competency_*)", "Оценки за курсы → кандидаты на подтверждение навыка", "Список студентов группы (core_user_get_users)"),
        auth="Токен веб-сервиса (REST)", docs="https://docs.moodle.org/dev/Web_service_API_functions",
        fields=(Field("base_url", "Адрес Moodle", "https://lms.university.ru"), Field("token", "Токен веб-сервиса", secret=True)),
    ),
    ConnectorSpec(
        id="1c-university", name="1С:Университет ПРОФ", vendor="1С", category="erp", roles=("curator",),
        summary="Контингент и учебные планы: группы, практики по учебному плану и результаты промежуточной аттестации.",
        capabilities=("Синхронизация групп и студентов", "Сроки практики из учебного плана → дедлайны в боте", "Результаты зачётов → подтверждение навыков"),
        auth="Стандартный интерфейс OData (Basic Auth сервисной учётной записи)", docs="https://v8.1c.ru/platforma/rest-interfeys/",
        fields=(Field("odata_url", "Адрес OData", "https://1c.university.ru/univer/odata/standard.odata"), Field("login", "Сервисный пользователь"), Field("password", "Пароль", secret=True)),
    ),
)

BY_ID = {c.id: c for c in CONNECTORS}

CATEGORY_LABEL = {"ats": "ATS работодателя", "jobboard": "Сайт вакансий", "lms": "ЭИОС / LMS вуза", "erp": "Учётная система вуза", "gov": "Госсервис"}
