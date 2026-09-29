import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { api, hasSession, logout, type Profile } from "./lib/api";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Register from "./pages/Register";
import InviteAccept from "./pages/InviteAccept";
import Overview from "./pages/Overview";
import Vacancies from "./pages/Vacancies";
import VacancyDetail from "./pages/VacancyDetail";
import VacancyForm from "./pages/VacancyForm";
import StudentDirectory from "./pages/StudentDirectory";
import Groups from "./pages/Groups";
import GroupDetail from "./pages/GroupDetail";
import Review from "./pages/Review";
import Tests from "./pages/Tests";
import Analytics from "./pages/Analytics";
import Leaderboard from "./pages/Leaderboard";
import Team from "./pages/Team";
import Integrations from "./pages/Integrations";
import Certificate from "./pages/Certificate";
import Portfolio from "./pages/Portfolio";
import Settings from "./pages/Settings";
import ConsentRenewal from "./components/ConsentRenewal";
import { ToastProvider } from "./components/ui";

// Login/register vs. the authenticated app, mounted under the "/*" branch
// below — kept separate from the public routes (see App) so a shared
// certificate or portfolio link never redirects a visitor to Login.
function AuthGate() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [checked, setChecked] = useState(false);

  function reloadProfile() {
    return api.getMe().then(setProfile).catch(() => logout());
  }

  useEffect(() => {
    if (!hasSession()) {
      setChecked(true);
      return;
    }
    reloadProfile().finally(() => setChecked(true));
  }, []);

  useEffect(() => {
    const onUnauthorized = () => setProfile(null);
    window.addEventListener("praktikaplus:unauthorized", onUnauthorized);
    return () => window.removeEventListener("praktikaplus:unauthorized", onUnauthorized);
  }, []);

  if (!checked) return <div className="flex min-h-screen items-center justify-center"><img src="/logo-mark.svg" alt="" className="h-12 w-12 animate-pulse" /></div>;

  if (!profile) {
    return (
      <Routes>
        <Route path="/register" element={<Register onRegistered={() => reloadProfile()} />} />
        <Route path="/invite/:token" element={<InviteAccept onAccepted={() => reloadProfile()} />} />
        <Route path="*" element={<Login onLoggedIn={() => reloadProfile()} />} />
      </Routes>
    );
  }

  if (profile.role !== "hr" && profile.role !== "curator") {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="card max-w-sm p-8 text-center">
          <h1 className="text-lg font-bold text-slate-900">Кабинет для вузов и компаний</h1>
          <p className="mt-2 text-sm text-slate-500">Студенты работают в мини-приложении ПрактикаПлюс в MAX.</p>
          <button onClick={() => { logout(); setProfile(null); }} className="btn-secondary mt-5 w-full">Выйти</button>
        </div>
      </div>
    );
  }

  if (!profile.consent_complete) return <ConsentRenewal profile={profile} onAccepted={setProfile} />;

  const hr = profile.role === "hr";
  return (
    <Layout profile={profile} onLogout={() => { logout(); setProfile(null); }}>
      <Routes>
        <Route path="/" element={<Overview profile={profile} />} />
        <Route path="/analytics" element={<Analytics profile={profile} />} />
        <Route path="/leaderboard" element={<Leaderboard />} />
        <Route path="/tests" element={<Tests profile={profile} />} />
        <Route path="/team" element={<Team profile={profile} />} />
        <Route path="/integrations" element={<Integrations profile={profile} />} />
        {hr && (
          <>
            <Route path="/vacancies" element={<Vacancies />} />
            <Route path="/vacancies/new" element={<VacancyForm />} />
            <Route path="/vacancies/:id" element={<VacancyDetail profile={profile} />} />
            <Route path="/vacancies/:id/edit" element={<VacancyForm />} />
            <Route path="/board" element={<Navigate to="/vacancies" replace />} />
            <Route path="/directory" element={<StudentDirectory />} />
          </>
        )}
        {!hr && (
          <>
            <Route path="/groups" element={<Groups profile={profile} />} />
            <Route path="/groups/:id" element={<GroupDetail profile={profile} />} />
            <Route path="/review" element={<Review />} />
            <Route path="/students" element={<Navigate to="/review" replace />} />
          </>
        )}
        <Route path="/settings" element={<Settings profile={profile} onProfile={setProfile} />} />
        <Route path="/invite/:token" element={<Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/certificate/:studentId/:skillId/:token" element={<Certificate />} />
          <Route path="/p/:token" element={<Portfolio />} />
          <Route path="/*" element={<AuthGate />} />
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
}
