"""Connector interface and per-system specifications.

Each class documents *how* the exchange works (endpoints, field mapping) so
the pilot can switch it on without redesign. In the MVP the methods raise
NotImplementedError: no data leaves ПрактикаПлюс and nothing is imported.
"""

from abc import ABC


class NotEnabledYet(NotImplementedError):
    def __init__(self, connector: str):
        super().__init__(f"Connector '{connector}' is specified; data exchange is enabled at the pilot stage")


class Connector(ABC):
    id = ""

    def __init__(self, settings: dict):
        self.settings = settings

    # --- employer side -------------------------------------------------------
    def import_vacancies(self) -> list[dict]:
        """External vacancies → ПрактикаПлюс Vacancy(title, description, region, city, core/optional skills)."""
        raise NotEnabledYet(self.id)

    def export_candidate(self, application: dict) -> str:
        """ApplicationOut → candidate in the external ATS; returns the external id."""
        raise NotEnabledYet(self.id)

    # --- university side ---------------------------------------------------------
    def import_students(self, group: str) -> list[dict]:
        """Group roster → students pre-registered with university/group."""
        raise NotEnabledYet(self.id)

    def import_competencies(self, student_external_id: str) -> list[dict]:
        """Achieved competencies/grades → candidates for curator verification."""
        raise NotEnabledYet(self.id)


class HuntflowConnector(Connector):
    """Хантфлоу API v2 (https://api.huntflow.ru/latest/docs), Bearer token.

    export_candidate:
      POST /v2/accounts/{account_id}/applicants            — ФИО, контакт, вуз/группа
      POST /v2/accounts/{account_id}/applicants/{id}/vacancy — привязка к вакансии,
           комментарий: индекс соответствия, подтверждённые навыки, ответ на задание
    webhooks: APPLICANT (смена этапа) → PATCH /api/applications/{id} + уведомление в MAX
    """

    id = "huntflow"


class PotokConnector(Connector):
    """«Поток Рекрутмент», открытое API и вебхуки (https://potok.io/features/otkrytoe-api-potok/).

    export_candidate: создание кандидата и отклика на вакансию с тегами навыков
    («подтверждено вузом»), вебхук смены этапа → статус отклика в ПрактикаПлюс.
    """

    id = "potok"


class HhConnector(Connector):
    """hh.ru API (https://api.hh.ru/openapi/redoc), OAuth 2.0 приложения работодателя.

    import_vacancies:
      GET /vacancies?employer_id={employer_id}&experience=noExperience
      GET /vacancies/{id} → key_skills[] → required_skills (все ключевые, вес 2)
    """

    id = "hh"


class SuperJobConnector(Connector):
    """SuperJob API (https://api.superjob.ru/): GET /2.0/vacancies/?id_client=…
    → вакансии для студентов; требования сопоставляются с каталогом навыков."""

    id = "superjob"


class TrudvsemConnector(Connector):
    """«Работа России», открытые данные (https://trudvsem.ru/opendata/api), без авторизации.

    import_vacancies: GET http://opendata.trudvsem.ru/api/v1/vacancies/company/inn/{inn}
    региональная аналитика: GET /api/v1/vacancies/region/{region_code} → спрос на навыки
    для отчёта кафедры рядом с «упущенным спросом» ПрактикаПлюс.
    """

    id = "trudvsem"


class MoodleConnector(Connector):
    """Moodle Web Services REST (https://docs.moodle.org/dev/Web_service_API_functions).

    {base_url}/webservice/rest/server.php?wstoken=…&moodlewsrestformat=json&wsfunction=…
      import_students:      core_user_get_users (по полю department/группы)
      import_competencies:  core_competency_list_user_plans → core_competency_read_plan
                            (компетенции со статусом «освоена» → предложение куратору подтвердить навык)
    """

    id = "moodle"


class OneCUniversityConnector(Connector):
    """1С:Университет ПРОФ через стандартный интерфейс OData платформы 1С
    (https://v8.1c.ru/platforma/rest-interfeys/), сервисная учётная запись.

      import_students: Catalog_Студенты / Catalog_УчебныеГруппы ($filter по группе)
      сроки практики:  документы учебного плана → дедлайны и напоминания в боте
      import_competencies: результаты промежуточной аттестации → предложения куратору
    """

    id = "1c-university"


REGISTRY: dict[str, type[Connector]] = {
    cls.id: cls
    for cls in (HuntflowConnector, PotokConnector, HhConnector, SuperJobConnector, TrudvsemConnector, MoodleConnector, OneCUniversityConnector)
}
