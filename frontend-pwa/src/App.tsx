import { Compass, GraduationCap, Inbox, Loader2, RefreshCw, Sparkles, UserRound, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { api, ApiError, authenticate, isSandbox, type GroupInvite, type Profile as ProfileData } from "./lib/api";
import { haptic } from "./lib/max";
import Feed from "./pages/Feed";
import Applications from "./pages/Applications";
import Profile from "./pages/Profile";
import Onboarding from "./pages/Onboarding";
import ConsentRenewal from "./components/ConsentRenewal";
import { Avatar, ToastProvider, useToast } from "./components/ui";

type Tab = "feed" | "apps" | "profile";

function groupCodeFrom(startParam: string | null): string | null {
  if (startParam?.startsWith("g_")) return startParam.slice(2);
  return new URL(window.location.href).searchParams.get("group");
}

function parseStart(startParam: string | null): { tab: Tab; vacancyId: number | null } {
  if (!startParam) return { tab: "feed", vacancyId: null };
  const vac = /^vac_(\d+)$/.exec(startParam);
  if (vac) return { tab: "feed", vacancyId: Number(vac[1]) };
  if (startParam === "apps") return { tab: "apps", vacancyId: null };
  if (startParam === "profile") return { tab: "profile", vacancyId: null };
  return { tab: "feed", vacancyId: null };
}

function Shell() {
  const toast = useToast();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [groupCode, setGroupCode] = useState<string | null>(null);
  const [groupOffer, setGroupOffer] = useState<GroupInvite | null>(null);
  const [fatal, setFatal] = useState("");
  const [tab, setTab] = useState<Tab>("feed");
  const [deepVacancy, setDeepVacancy] = useState<number | null>(null);
  const [appsVersion, setAppsVersion] = useState(0);
  const [appsCount, setAppsCount] = useState(0);
  const [consentNeeded, setConsentNeeded] = useState(false);
  const [sandboxHidden, setSandboxHidden] = useState(() => {
    try { return sessionStorage.getItem("praktikaplus.sandbox-hint") === "hidden"; } catch { return false; }
  });
  const hideSandbox = () => {
    setSandboxHidden(true);
    try { sessionStorage.setItem("praktikaplus.sandbox-hint", "hidden"); } catch { /* ignore */ }
  };

  const boot = useCallback(() => {
    setFatal("");
    authenticate()
      .then(({ startParam }) => {
        const start = parseStart(startParam);
        setTab(start.tab);
        setDeepVacancy(start.vacancyId);
        setGroupCode(groupCodeFrom(startParam));
        return api.getMe();
      })
      .then(setProfile)
      .catch((e) => setFatal(e instanceof ApiError ? e.message : "Не удалось войти в ПрактикаПлюс."));
  }, []);

  useEffect(boot, [boot]);

  useEffect(() => {
    const onConsent = () => setConsentNeeded(true);
    window.addEventListener("praktikaplus:consent-required", onConsent);
    return () => window.removeEventListener("praktikaplus:consent-required", onConsent);
  }, []);

  useEffect(() => {
    if (profile?.role !== "student") return;
    api.listMyApplications().then((items) => setAppsCount(items.length)).catch(() => {});
  }, [profile?.role, appsVersion]);

  const consumeDeepLink = useCallback(() => setDeepVacancy(null), []);

  // A registered student who opens a group invite is offered to join that group.
  useEffect(() => {
    if (!groupCode || profile?.role !== "student" || profile.group_locked) return;
    api.groupInvite(groupCode).then(setGroupOffer).catch(() => {});
  }, [groupCode, profile?.role, profile?.group_locked]);

  async function joinGroup() {
    if (!profile || !groupCode) return;
    try {
      const updated = await api.updateMe({ name: profile.name, phone: profile.phone, contact_info: profile.contact_info, university: profile.university, group: profile.group, region: profile.region, city: profile.city, group_code: groupCode, accept_terms: false, accept_privacy: false });
      setProfile(updated);
      setGroupOffer(null);
      haptic.success();
      toast("success", `Вы в группе ${updated.group} — куратор увидит ваш профиль`);
    } catch (e) {
      toast("error", e instanceof ApiError ? e.message : "Не удалось присоединиться к группе");
    }
  }

  if (fatal) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-8 text-center">
        <img src="/logo-mark.svg" alt="" className="h-14 w-14" />
        <p className="max-w-xs text-sm text-slate-600">{fatal}</p>
        <button onClick={boot} className="btn-primary"><RefreshCw className="h-4 w-4" />Повторить</button>
      </div>
    );
  }
  if (!profile) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3">
        <img src="/logo-mark.svg" alt="" className="h-14 w-14 animate-pulse" />
        <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
      </div>
    );
  }

  // New user: explicit registration; a group invite fills in and locks university, group, region and city.
  if (!profile.role) {
    return <Onboarding initialName={profile.name} groupCode={groupCode} onDone={(p) => { setProfile(p); setTab("feed"); setGroupCode(null); }} />;
  }

  if (!profile.consent_complete || consentNeeded) {
    return <ConsentRenewal profile={profile} onAccepted={(p) => { setConsentNeeded(false); setProfile(p); }} />;
  }

  const tabs: { key: Tab; label: string; icon: typeof Compass; badge?: number }[] = [
    { key: "feed", label: "Стажировки", icon: Compass },
    { key: "apps", label: "Отклики", icon: Inbox, badge: appsCount },
    { key: "profile", label: "Профиль", icon: UserRound },
  ];

  return (
    <div className="mx-auto min-h-screen max-w-md">
      <header className="sticky top-0 z-30 flex items-center justify-between bg-[#f4f6fb]/90 px-4 pb-3 pt-4 backdrop-blur">
        <div className="flex items-center gap-2">
          <img src="/logo-mark.svg" alt="" className="h-8 w-8" />
          <span className="text-[17px] font-extrabold tracking-tight">Практика<span className="text-blue-700">Плюс</span></span>
        </div>
        <button onClick={() => setTab("profile")} className="flex items-center gap-2" aria-label="Мой профиль и баллы">
          <span className="flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700 ring-1 ring-amber-200"><Sparkles className="h-3.5 w-3.5" />{profile.points}</span>
          <Avatar name={profile.name} src={profile.avatar_url} size={32} />
        </button>
      </header>

      {isSandbox() && !sandboxHidden && (
        <div className="mx-4 mb-3 flex items-center gap-2 rounded-xl bg-violet-50 px-3 py-2 text-[11px] leading-4 text-violet-800 ring-1 ring-violet-200">
          <span className="flex-1">Песочница в браузере: тестовый студент. В MAX вход — автоматически по подписи MAX.</span>
          <button onClick={hideSandbox} aria-label="Скрыть" className="rounded-md p-1 text-violet-500 hover:bg-violet-100"><X className="h-3.5 w-3.5" /></button>
        </div>
      )}

      {groupOffer && (
        <div className="mx-4 mb-3 rounded-2xl bg-emerald-50 p-3.5 ring-1 ring-emerald-200">
          <p className="flex items-center gap-2 text-sm font-bold text-emerald-900"><GraduationCap className="h-4 w-4" />Вуз приглашает вас в группу {groupOffer.group}</p>
          <p className="mt-1 text-xs text-emerald-800">{groupOffer.university} · {groupOffer.city}</p>
          <div className="mt-3 flex gap-2"><button onClick={joinGroup} className="btn-primary flex-1 py-2 text-xs">Присоединиться</button><button onClick={() => setGroupOffer(null)} className="btn-secondary py-2 text-xs">Позже</button></div>
        </div>
      )}

      <main className="px-4 pb-28">
        {tab === "feed" && (
          <Feed
            profile={profile}
            openVacancyId={deepVacancy}
            onConsumedDeepLink={consumeDeepLink}
            onApplied={() => setAppsVersion((v) => v + 1)}
            onGoToProfile={() => setTab("profile")}
            onGoToApplications={() => setTab("apps")}
          />
        )}
        {tab === "apps" && <Applications refreshKey={appsVersion} onGoToFeed={() => setTab("feed")} />}
        {tab === "profile" && (
          <Profile
            profile={profile}
            onProfile={setProfile}
            onReset={() => { setTab("feed"); setAppsCount(0); api.getMe().then(setProfile).catch(() => setFatal("Профиль сброшен. Откройте приложение заново.")); }}
          />
        )}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-md border-t border-slate-200/80 bg-white/95 pb-safe backdrop-blur" aria-label="Разделы">
        <div className="grid grid-cols-3">
          {tabs.map(({ key, label, icon: Icon, badge }) => {
            const active = tab === key;
            return (
              <button key={key} onClick={() => { if (!active) haptic.select(); setTab(key); window.scrollTo({ top: 0 }); }} aria-current={active ? "page" : undefined} className={`relative flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold transition ${active ? "text-blue-700" : "text-slate-400"}`}>
                <span className={`flex h-8 w-14 items-center justify-center rounded-full transition ${active ? "bg-blue-50" : ""}`}><Icon className="h-5 w-5" strokeWidth={active ? 2.4 : 2} /></span>
                {label}
                {badge ? <span className="absolute right-[calc(50%-26px)] top-1.5 min-w-[18px] rounded-full bg-blue-600 px-1 text-[10px] font-bold leading-[18px] text-white">{badge}</span> : null}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <Shell />
    </ToastProvider>
  );
}
