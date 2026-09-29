// Продовый адрес API задан по умолчанию; для локального запуска его
// переопределяет VITE_API_BASE_URL (см. compose.yaml и README).
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "https://api.praktikaplus.max.it-integrators.ru";
export const LEGAL_BASE_URL = import.meta.env.VITE_LEGAL_BASE_URL || "https://praktikaplus.max.it-integrators.ru";
export const BOT_USERNAME = import.meta.env.VITE_MAX_BOT_USERNAME || "t417_hakaton_max_bot";

const TOKEN_KEY = "praktikaplus-pwa.jwt";
const START_PARAM_KEY = "praktikaplus-pwa.start-param";
const DEV_KEY = "praktikaplus.dev-student-id";

export type MatchStatus = "verified" | "employer" | "claimed" | "related" | "missing";
export type SkillStatus = "claimed" | "verified" | "employer_review" | "rejected";

export interface MatchItem { skill: string; is_core: boolean; status: MatchStatus; via: string | null }
export interface Match { score: number; verified_score: number; potential: number; level: "high" | "medium" | "low" | "none"; items: MatchItem[]; missing: string[]; missing_core: string[] }

export interface Vacancy {
  vacancy_id: number;
  company_id: string;
  company_name: string;
  title: string;
  description: string;
  has_test_task: boolean;
  test_questions_count: number;
  region: string;
  city: string;
  is_active: boolean;
  required_skills: string[];
  core_skills: string[];
  optional_skills: string[];
  created_at: string;
  match_score: number | null;
  missing_skills: string[];
  match: Match | null;
  my_application_status: ApplicationStatus | null;
}

export type ApplicationStatus = "pending" | "accepted" | "rejected" | "missed";
export interface ApplicationEvent { kind: string; note: string; created_at: string }
export interface NextStep { format: "online" | "office" | "start" | "call"; datetime: string; place: string; contact_name: string; contact_phone: string; message: string }

export interface Application {
  app_id: number;
  vacancy_id: number;
  vacancy_title: string;
  company_name: string;
  student_id: string;
  student_name: string;
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
  events: ApplicationEvent[];
  next_step: NextStep | null;
  company_contact: string;
}

export interface Profile {
  user_id: string;
  role: "student" | "hr" | "curator" | "";
  name: string;
  contact_info: string;
  phone: string;
  university: string;
  group: string;
  group_id: number | null;
  group_locked: boolean;
  region: string;
  city: string;
  directory_opt_in: boolean;
  student_directory_opt_in: boolean;
  avatar_url: string;
  portfolio_public: boolean;
  portfolio_url: string;
  portfolio_show_contact: boolean;
  points: number;
  consent_complete: boolean;
}

export interface SkillTest {
  test_id: number;
  title: string;
  description: string;
  skill: string;
  university: string;
  author_name: string;
  partner_name: string;
  status: string;
  pass_score: number;
  max_attempts: number;
  questions_count: number;
  attempts_used: number | null;
  best_score: number | null;
  passed: boolean | null;
  questions?: { id: number; text: string; options: string[] }[];
}

export interface TestResult { score: number; passed: boolean; correct: boolean[]; attempts_left: number; skill: string; skill_verified: boolean }

export interface StudentSkill { skill_id: number; name: string; is_verified: boolean; status: SkillStatus; comment: string; reviewed_by: string; reviewed_at: string | null }
export interface GroupInvite { university: string; group: string; region: string; city: string; course: number; specialty: string }
export interface GeoRegion { region: string; cities: string[] }
export interface Achievement { key: string; title: string; description: string; earned: boolean; progress: number; goal: number }
export interface StudentProgress { points: number; level: number; next_level_points: number; achievements: Achievement[] }
export interface University { name: string; students: number; has_curator: boolean }

export type ProfileInput = Pick<Profile, "name" | "contact_info" | "phone" | "university" | "group" | "region" | "city"> & { accept_terms: boolean; accept_privacy: boolean; group_code?: string | null };

/** Human-readable messages for the API's English `detail` strings. */
const MESSAGES: Record<string, string> = {
  "Vacancy not found": "Стажировка закрыта или больше недоступна.",
  "The application is no longer accepting answers": "Работодатель уже принял решение — ответ больше не принимается.",
  "Answer cannot be empty": "Напишите ответ перед отправкой.",
  "A verified skill can only be withdrawn by the curator": "Подтверждённый навык может снять только куратор.",
  "Too many skills in one profile": "В профиле уже максимум навыков.",
  "Accept the terms and personal data consent to create a profile": "Примите условия и согласие на обработку данных.",
  "Missing MAX launch data": "Откройте приложение из чата с ботом в MAX.",
  "Invalid MAX launch signature": "Сессия MAX устарела. Закройте и снова откройте приложение из чата с ботом.",
  "The test is already passed": "Этот тест уже сдан — навык подтверждён.",
  "No attempts left": "Попытки закончились. Обратитесь к куратору.",
  "Answer every question": "Ответьте на все вопросы.",
  "Invite link is not valid": "Ссылка-приглашение группы недействительна — попросите у куратора новую.",
  "Choose the region from the list": "Выберите регион из списка.",
  "Choose the city from the list for the selected region": "Выберите город из списка для выбранного региона.",
  "Answer is too long": "Ответ слишком длинный.",
  "Shared demo profiles cannot be reset": "Это общий демо-профиль для проверки — его сбросить нельзя. Откройте приложение под своим аккаунтом MAX.",
};

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(MESSAGES[message] || (status >= 500 ? "Сервис временно недоступен. Повторите попытку через минуту." : message));
  }
}

function getToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}

let reauthPromise: Promise<unknown> | null = null;

async function request<T>(path: string, options: RequestInit = {}, retried = false): Promise<T> {
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
    throw new ApiError(0, "Нет соединения с сервером. Проверьте интернет и повторите.");
  }
  if (res.status === 401 && !retried && path !== "/api/auth") {
    // The JWT lives 12 h; MAX keeps the mini app open longer. Re-auth once silently.
    reauthPromise = reauthPromise || authenticate().finally(() => { reauthPromise = null; });
    await reauthPromise;
    return request<T>(path, options, true);
  }
  if (res.status === 428) window.dispatchEvent(new Event("praktikaplus:consent-required"));
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    throw new ApiError(res.status, typeof body.detail === "string" ? body.detail : "Не удалось выполнить действие");
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

/** Browser sandbox identity for testing outside MAX (`?student_id=demo-student-1`
 * shows a demo student). The backend accepts only `dev-…`/`demo-…` ids here. */
function getDevIdentity(): { user_id: string; name: string } {
  const url = new URL(window.location.href);
  const fromQuery = url.searchParams.get("student_id");
  if (fromQuery && /^(dev|demo)-[A-Za-z0-9_-]{1,48}$/.test(fromQuery)) {
    return { user_id: fromQuery, name: url.searchParams.get("name") || "Тестовый студент" };
  }
  let id: string | null = null;
  try { id = localStorage.getItem(DEV_KEY); } catch { /* storage may be blocked */ }
  if (!id) {
    id = "dev-" + Math.random().toString(36).slice(2, 10);
    try { localStorage.setItem(DEV_KEY, id); } catch { /* ignore */ }
  }
  return { user_id: id, name: "Тестовый студент" };
}

export function isSandbox(): boolean {
  return !window.WebApp?.initData;
}

export async function authenticate(): Promise<{ role: string | null; startParam: string | null }> {
  window.WebApp?.ready?.();
  const initData = window.WebApp?.initData;
  const body = initData ? { init_data: initData } : getDevIdentity();
  const data = await request<{ token: string; role: string | null; profile_complete: boolean; start_param?: string | null }>("/api/auth", {
    method: "POST",
    body: JSON.stringify(body),
  });
  try {
    localStorage.setItem(TOKEN_KEY, data.token);
    if (data.start_param) localStorage.setItem(START_PARAM_KEY, data.start_param);
    else localStorage.removeItem(START_PARAM_KEY);
  } catch { /* ignore */ }
  const urlStart = new URL(window.location.href).searchParams.get("startapp");
  return { role: data.role, startParam: data.start_param || urlStart };
}

export function miniappLink(payload = "app"): string {
  return `https://max.ru/${BOT_USERNAME}?startapp=${payload}`;
}

export const botChatLink = `https://max.ru/${BOT_USERNAME}`;

export const api = {
  getMe: () => request<Profile>("/api/me"),
  updateMe: (profile: ProfileInput) => request<Profile>("/api/me", { method: "PUT", body: JSON.stringify({ role: "student", ...profile }) }),
  resetProfile: () => request<{ removed_skills: number; removed_applications: number; profile: Profile }>("/api/me/reset", { method: "POST" }),
  setStudentDiscoverable: (student_directory_opt_in: boolean) => request<Profile>("/api/me/discoverable", { method: "PATCH", body: JSON.stringify({ student_directory_opt_in }) }),
  claimSkill: (skill_name: string) => request<StudentSkill>("/api/me/skills", { method: "POST", body: JSON.stringify({ skill_name }) }),
  mySkills: () => request<StudentSkill[]>("/api/me/skills"),
  removeSkill: (skill_id: number) => request<void>(`/api/me/skills/${skill_id}`, { method: "DELETE" }),
  myCertificateLink: (skill_id: number) => request<{ url: string }>(`/api/me/skills/${skill_id}/certificate-link`),
  myProgress: () => request<StudentProgress>("/api/me/progress"),
  listSkills: (scope: "all" | "vacancies" = "all") => request<{ skill_id: number; name: string }[]>(`/api/skills?scope=${scope}`),
  universities: () => request<University[]>("/api/universities"),
  listVacancies: (tags: string[] = []) => request<Vacancy[]>(`/api/vacancies${tags.length ? `?tags=${encodeURIComponent(tags.join(","))}` : ""}`),
  getVacancy: (id: number) => request<Vacancy>(`/api/vacancies/${id}`),
  apply: (vacancy_id: number) => request<Application>("/api/applications", { method: "POST", body: JSON.stringify({ vacancy_id }) }),
  answerApplication: (app_id: number, answers: string[]) => request<Application>(`/api/applications/${app_id}/answer`, { method: "POST", body: JSON.stringify({ answers }) }),
  groupInvite: (code: string) => request<GroupInvite>(`/api/public/groups/${encodeURIComponent(code)}`),
  geo: () => request<{ regions: GeoRegion[] }>("/api/geo"),
  setPortfolio: (isPublic: boolean, show_contact: boolean) => request<Profile>("/api/me/portfolio", { method: "PATCH", body: JSON.stringify({ public: isPublic, show_contact }) }),
  listMyApplications: () => request<Application[]>("/api/applications"),
  listTests: () => request<SkillTest[]>("/api/tests"),
  getTest: (id: number) => request<SkillTest>(`/api/tests/${id}`),
  submitTest: (id: number, answers: number[]) => request<TestResult>(`/api/tests/${id}/attempts`, { method: "POST", body: JSON.stringify({ answers }) }),
};
