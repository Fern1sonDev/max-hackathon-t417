const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "https://api.praktikaplus.max.it-integrators.ru";
export const LEGAL_BASE_URL = import.meta.env.VITE_LEGAL_BASE_URL || "https://praktikaplus.max.it-integrators.ru";

const TOKEN_KEY = "praktikaplus-lk.jwt";

export type Role = "student" | "hr" | "curator" | "";

export interface Profile {
  user_id: string;
  role: Role;
  name: string;
  contact_info: string;
  phone: string;
  position: string;
  person_name: string;
  university: string;
  group: string;
  region: string;
  city: string;
  directory_opt_in: boolean;
  student_directory_opt_in: boolean;
  avatar_url: string;
  consent_complete: boolean;
  org_id: string;
  org_name: string;
  is_owner: boolean;
}

export interface VacancyStats { total: number; pending: number; accepted: number; rejected: number; missed: number; answered: number; new_24h: number; avg_match: number }

export interface Vacancy {
  vacancy_id: number;
  company_id: string;
  company_name: string;
  title: string;
  description: string;
  test_task: string;
  test_questions: string[];
  test_questions_count: number;
  has_test_task: boolean;
  region: string;
  city: string;
  is_active: boolean;
  required_skills: string[];
  core_skills: string[];
  optional_skills: string[];
  created_at: string;
  applications_count: number | null;
  stats: VacancyStats | null;
}

export type MatchStatus = "verified" | "employer" | "claimed" | "related" | "missing";
export type SkillStatus = "claimed" | "verified" | "employer_review" | "rejected";
export interface MatchItem { skill: string; is_core: boolean; status: MatchStatus; via: string | null }
export interface Match { score: number; verified_score: number; potential: number; level: string; items: MatchItem[]; missing: string[]; missing_core: string[] }
export interface ApplicationEvent { kind: string; note: string; created_at: string }
export interface Funnel { applications: number; answered: number; accepted: number; rejected: number; missed: number; avg_match: number; median_hours_to_decision: number | null }

export interface RegionStat { region: string; students: number; vacancies: number }
export interface SkillGapStat { skill: string; required: number; verified: number }
export interface UnmetDemandStat { skill: string; searches: number; avg_results: number }
export interface LeaderboardEntry { student_id: string; name: string; university: string; points: number; verified_skills_count: number; avatar_url: string }

export interface EmployerStat { company: string; region: string; city: string; vacancies: number; applications_from_us: number; accepted_from_us: number; top_skills: string[] }
export interface SkillDemandStat { skill: string; vacancies: number; our_verified: number; our_claimed: number }
export interface GroupStat { group: string; students: number; with_applications: number; accepted: number; verified_share: number }
export interface UniversityAnalytics {
  region: string; city: string; students: number; groups: number; verified_skills: number; to_review: number; applications: number; accepted: number;
  employers_in_region: number; vacancies_in_region: number; employers: EmployerStat[]; skills_demand: SkillDemandStat[]; by_group: GroupStat[];
}

export interface Certificate { student_name: string; university: string; skill: string; verified_by_name: string; verified_at: string; comment: string }

export interface NextStep { format: "online" | "office" | "start" | "call"; datetime: string; place: string; contact_name: string; contact_phone: string; message: string }
export type ApplicationStatus = "pending" | "accepted" | "rejected" | "missed";

export interface Application {
  app_id: number;
  vacancy_id: number;
  vacancy_title: string;
  company_name: string;
  student_id: string;
  student_name: string;
  student_university: string;
  student_group: string;
  student_contact: string;
  student_phone: string;
  student_avatar_url: string;
  test_task: string;
  test_questions: string[];
  test_answer: string;
  test_answers: string[];
  status: ApplicationStatus;
  match_score: number;
  match: Match | null;
  skills_verified: boolean;
  created_at: string;
  updated_at: string;
  is_overdue: boolean;
  events: ApplicationEvent[];
  next_step: NextStep | null;
  pending_decision_until: string | null;
}

export interface StudentSkill { skill_id: number; name: string; is_verified: boolean; status: SkillStatus; comment: string; reviewed_by: string; reviewed_at: string | null }

export interface Student {
  user_id: string;
  name: string;
  contact_info: string;
  phone: string;
  university: string;
  group: string;
  group_id: number | null;
  region: string;
  city: string;
  skills: StudentSkill[];
  is_passive: boolean;
  avatar_url: string;
  applications: number;
  accepted: number;
}

export interface Group {
  group_id: number; name: string; course: number; specialty: string; university: string; region: string; city: string;
  curator_id: string | null; curator_name: string; invite_code: string; invite_url: string;
  students_count: number; to_review: number; with_applications: number; accepted: number; passive: number;
}
export interface GroupInput { name: string; course: number; specialty: string; region: string; city: string; curator_id?: string | null }

export interface TeamMember { user_id: string; name: string; email: string; position: string; is_owner: boolean; created_at: string }
export interface TeamInvite { token: string; name: string; email: string; position: string; url: string; expires_at: string }
export interface Team { org_name: string; role: string; members: TeamMember[]; invites: TeamInvite[] }
export interface InvitePublic { org_name: string; role: string; name: string; email: string; position: string }

export interface TestQuestion { id?: number; text: string; options: string[]; correct_index?: number | null }
export interface SkillTest {
  test_id: number; title: string; description: string; skill: string; university: string; author_name: string; author_role: string;
  partner_company_id: string | null; partner_name: string; status: string; pass_score: number; max_attempts: number; questions_count: number;
  created_at: string; attempts_total: number | null; pass_rate: number | null; can_manage: boolean; questions?: TestQuestion[] | null;
}
export interface SkillTestInput {
  title: string; description: string; skill: string; pass_score: number; max_attempts: number;
  questions: { text: string; options: string[]; correct_index: number }[]; university?: string; partner_company_id?: string | null; publish: boolean;
}

export interface IntegrationField { key: string; label: string; placeholder: string; secret: boolean; required: boolean }
export interface Integration {
  id: string; name: string; vendor: string; category: string; category_label: string; summary: string; capabilities: string[];
  auth: string; docs: string; fields: IntegrationField[]; connected: boolean; status: string | null; status_label: string;
  settings: Record<string, string>; connected_at: string | null;
}

export interface Portfolio {
  name: string; avatar_url: string; university: string; group: string; city: string; region: string; contact: string;
  verified: StudentSkill[]; employer_review: StudentSkill[]; claimed: string[]; tests_passed: string[]; points: number; certificate_urls: Record<string, string>;
}

export interface GeoRegion { region: string; cities: string[] }

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function getToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}

function setToken(token: string) {
  try { localStorage.setItem(TOKEN_KEY, token); } catch { /* private mode */ }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
    });
  } catch {
    throw new ApiError(0, "Нет соединения с сервером");
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    if (res.status === 401 && token) {
      logout();
      window.dispatchEvent(new Event("praktikaplus:unauthorized"));
    }
    const detail = typeof body.detail === "string" ? body.detail : Array.isArray(body.detail) ? "Проверьте заполнение полей" : "Request failed";
    throw new ApiError(res.status, detail);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export function hasSession(): boolean {
  return !!getToken();
}

export function logout() {
  try { localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ }
}

export interface RegisterInput {
  role: "hr" | "curator";
  name: string;
  person_name?: string;
  position?: string;
  phone?: string;
  email: string;
  password: string;
  university?: string;
  region?: string;
  city?: string;
  accept_terms: boolean;
  accept_privacy: boolean;
}

export async function register(payload: RegisterInput): Promise<void> {
  const auth = await request<{ token: string }>("/api/register", { method: "POST", body: JSON.stringify(payload) });
  setToken(auth.token);
}

export async function login(email: string, password: string): Promise<void> {
  const auth = await request<{ token: string }>("/api/login", { method: "POST", body: JSON.stringify({ email, password }) });
  setToken(auth.token);
}

export async function acceptInvite(token: string, payload: { name: string; password: string; accept_terms: boolean; accept_privacy: boolean }): Promise<void> {
  const auth = await request<{ token: string }>(`/api/invites/${encodeURIComponent(token)}/accept`, { method: "POST", body: JSON.stringify(payload) });
  setToken(auth.token);
}

export interface VacancyInput {
  title: string;
  description: string;
  test_questions: string[];
  region: string;
  city: string;
  required_skills: string[];
  optional_skills: string[];
}

const DETAIL_RU: Record<string, string> = {
  "Invalid email or password": "Неверный email или пароль",
  "Email already registered": "Этот email уже зарегистрирован",
  "Too many login attempts, try again in a few minutes": "Слишком много попыток входа. Подождите несколько минут.",
  "Password of a shared demo account cannot be changed": "Пароль общего демо-аккаунта менять нельзя — им пользуются другие проверяющие.",
  "Current password is incorrect": "Текущий пароль не подошёл",
  "Add at least one required skill": "Добавьте хотя бы один навык",
  "At least one skill must be a core requirement": "Хотя бы один навык должен быть ключевым",
  "University is required for a curator account": "Укажите вуз — без него куратор не увидит студентов",
  "Set your university in organization settings first": "Сначала укажите вуз в настройках",
  "Choose the region from the list": "Выберите регион из списка",
  "Choose the city from the list for the selected region": "Выберите город из списка для этого региона",
  "Only the organisation owner manages the team": "Командой управляет владелец аккаунта организации",
  "Invite not found or expired": "Приглашение не найдено или истекло — попросите руководителя прислать новое",
  "Accept the terms and personal data consent to register": "Примите условия и согласие на обработку данных",
  "Move the students to another group first": "Сначала переведите студентов в другую группу",
  "The decision has already been delivered": "Отменить уже нельзя — сообщение кандидату отправлено",
  "Curator must be a member of your university": "Куратор должен быть сотрудником вашего вуза",
  "Group not found": "Группа не найдена",
  "Vacancy not found": "Стажировка не найдена",
  "Portfolio not found": "Визитка скрыта студентом или ссылка устарела",
  "Choose the university the test is proposed to": "Выберите вуз, которому предлагаете тест",
  "Partner company not found": "Работодатель-соавтор не найден",
  "correct_index is out of range": "Отметьте правильный вариант ответа в каждом вопросе",
  "Test not found": "Тест не найден",
  "Connector not found": "Интеграция недоступна для вашей организации",
  "Member not found": "Сотрудник не найден",
};

export function humanError(e: unknown, fallback: string): string {
  if (e instanceof ApiError) return DETAIL_RU[e.message] || (e.status >= 500 || e.status === 0 ? "Сервис временно недоступен. Повторите попытку." : e.message);
  return fallback;
}

export const api = {
  getMe: () => request<Profile>("/api/me"),
  changePassword: (current_password: string, new_password: string) =>
    request<void>("/api/me/password", { method: "PATCH", body: JSON.stringify({ current_password, new_password }) }),
  updateMe: (profile: { role: Role; name: string; contact_info: string; phone: string; university: string; group: string; region: string; city: string; accept_terms: boolean; accept_privacy: boolean }) =>
    request<Profile>("/api/me", { method: "PUT", body: JSON.stringify(profile) }),
  setDirectoryOptIn: (directory_opt_in: boolean) =>
    request<Profile>("/api/me/directory-opt-in", { method: "PATCH", body: JSON.stringify({ directory_opt_in }) }),

  geo: () => request<{ source: string; regions: GeoRegion[] }>("/api/geo"),
  listSkills: () => request<{ skill_id: number; name: string }[]>("/api/skills"),
  universities: () => request<{ name: string; students: number; has_curator: boolean }[]>("/api/universities"),
  companies: () => request<{ user_id: string; name: string }[]>("/api/companies"),

  listMyVacancies: () => request<Vacancy[]>("/api/vacancies/mine"),
  getVacancy: (id: number) => request<Vacancy>(`/api/vacancies/${id}`),
  vacancyPipeline: (id: number) => request<Application[]>(`/api/vacancies/${id}/applications`),
  createVacancy: (v: VacancyInput) => request<Vacancy>("/api/vacancies", { method: "POST", body: JSON.stringify(v) }),
  updateVacancy: (vacancy_id: number, v: VacancyInput) => request<Vacancy>(`/api/vacancies/${vacancy_id}`, { method: "PATCH", body: JSON.stringify(v) }),
  toggleVacancyActive: (vacancy_id: number, is_active: boolean) =>
    request<Vacancy>(`/api/vacancies/${vacancy_id}/active`, { method: "PATCH", body: JSON.stringify({ is_active }) }),

  listApplications: () => request<Application[]>("/api/applications"),
  decide: (app_id: number, status: "pending" | "accepted" | "rejected", extra: { message?: string; next_step?: NextStep | null } = {}) =>
    request<Application>(`/api/applications/${app_id}`, { method: "PATCH", body: JSON.stringify({ status, ...extra }) }),
  undoDecision: (app_id: number) => request<Application>(`/api/applications/${app_id}/undo`, { method: "POST" }),

  listStudents: (filters: { q?: string; group_id?: number; to_review?: boolean } = {}) => {
    const params = new URLSearchParams();
    if (filters.q) params.set("q", filters.q);
    if (filters.group_id) params.set("group_id", String(filters.group_id));
    if (filters.to_review) params.set("to_review", "true");
    const qs = params.toString();
    return request<Student[]>(`/api/students${qs ? `?${qs}` : ""}`);
  },
  moveStudent: (student_id: string, group_id: number) => request<Student>(`/api/students/${student_id}`, { method: "PATCH", body: JSON.stringify({ group_id }) }),
  reviewSkills: (student_id: string, decisions: { skill_id: number; status: SkillStatus; comment: string }[]) =>
    request<{ changed: number; notified: boolean; student: Student }>(`/api/students/${student_id}/skills`, { method: "PUT", body: JSON.stringify({ decisions }) }),
  studentDirectory: (filters: { q?: string; region?: string; city?: string; university?: string } = {}) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value);
    const qs = params.toString();
    return request<Student[]>(`/api/students/directory${qs ? `?${qs}` : ""}`);
  },
  certificateLink: (student_id: string, skill_id: number) => request<{ url: string }>(`/api/students/${student_id}/skills/${skill_id}/certificate-link`),

  listGroups: () => request<Group[]>("/api/groups"),
  getGroup: (id: number) => request<Group>(`/api/groups/${id}`),
  groupStudents: (id: number) => request<Student[]>(`/api/groups/${id}/students`),
  createGroup: (g: GroupInput) => request<Group>("/api/groups", { method: "POST", body: JSON.stringify(g) }),
  updateGroup: (id: number, g: GroupInput) => request<Group>(`/api/groups/${id}`, { method: "PATCH", body: JSON.stringify(g) }),
  rotateGroupInvite: (id: number) => request<Group>(`/api/groups/${id}/rotate-invite`, { method: "POST" }),
  deleteGroup: (id: number) => request<void>(`/api/groups/${id}`, { method: "DELETE" }),

  team: () => request<Team>("/api/team"),
  inviteMember: (payload: { name: string; email: string; position: string }) => request<TeamInvite>("/api/team/invites", { method: "POST", body: JSON.stringify(payload) }),
  revokeInvite: (token: string) => request<void>(`/api/team/invites/${encodeURIComponent(token)}`, { method: "DELETE" }),
  removeMember: (user_id: string) => request<void>(`/api/team/members/${encodeURIComponent(user_id)}`, { method: "DELETE" }),
  getInvite: (token: string) => request<InvitePublic>(`/api/invites/${encodeURIComponent(token)}`),

  analyticsRegions: () => request<RegionStat[]>("/api/analytics/regions"),
  analyticsSkillsGap: () => request<SkillGapStat[]>("/api/analytics/skills-gap"),
  analyticsUnmetDemand: () => request<UnmetDemandStat[]>("/api/analytics/unmet-demand"),
  analyticsFunnel: () => request<Funnel>("/api/analytics/funnel"),
  analyticsUniversity: () => request<UniversityAnalytics>("/api/analytics/university"),
  leaderboard: () => request<LeaderboardEntry[]>("/api/leaderboard"),

  listTests: () => request<SkillTest[]>("/api/tests"),
  getTest: (id: number) => request<SkillTest>(`/api/tests/${id}`),
  createTest: (t: SkillTestInput) => request<SkillTest>("/api/tests", { method: "POST", body: JSON.stringify(t) }),
  setTestStatus: (id: number, status: "draft" | "published") => request<SkillTest>(`/api/tests/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
  deleteTest: (id: number) => request<void>(`/api/tests/${id}`, { method: "DELETE" }),

  integrations: () => request<Integration[]>("/api/integrations"),
  connectIntegration: (id: string, settings: Record<string, string>) => request<Integration>(`/api/integrations/${id}`, { method: "PUT", body: JSON.stringify({ settings }) }),
  disconnectIntegration: (id: string) => request<void>(`/api/integrations/${id}`, { method: "DELETE" }),

  portfolio: (token: string) => request<Portfolio>(`/api/public/portfolio/${encodeURIComponent(token)}`),
};

// Not JSON — needs the raw blob for a file download, so it bypasses request().
export async function exportApplicationsCsv(): Promise<Blob> {
  const token = getToken();
  const res = await fetch(`${API_BASE_URL}/api/applications/export`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) throw new ApiError(res.status, "Не удалось экспортировать отклики");
  return res.blob();
}

// Public — no auth token required, used by the standalone /certificate page.
export function getCertificate(studentId: string, skillId: string, token: string) {
  return request<Certificate>(`/api/certificates/${studentId}/${skillId}/${token}`);
}

export function formatDate(value: string, withTime = true) {
  const date = new Date(value.endsWith("Z") || value.includes("+") ? value : `${value}Z`);
  return date.toLocaleString("ru-RU", withTime ? { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" } : { day: "numeric", month: "long", year: "numeric" });
}

export function parseUtc(value: string): number {
  return new Date(value.endsWith("Z") || value.includes("+") ? value : `${value}Z`).getTime();
}

export { ApiError };
