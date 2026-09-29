import { useState, type ReactNode } from "react";
import type { Profile } from "../lib/api";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

export default function Layout({ profile, onLogout, children }: { profile: Profile; onLogout: () => void; children: ReactNode }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      <Sidebar profile={profile} mobileOpen={mobileNavOpen} onCloseMobile={() => setMobileNavOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar profile={profile} onLogout={onLogout} onOpenMobileNav={() => setMobileNavOpen(true)} />
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
