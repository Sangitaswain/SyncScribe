import { useEffect } from "react";
import { Outlet, useLocation } from "react-router";
import TopBar from "./TopBar";
import StatusBar from "./StatusBar";
import Toaster from "./Toaster";
import ReauthModal from "./ReauthModal";
import Sidebar from "./Sidebar";
import OfflineBanner from "./OfflineBanner";
import { isDesktop, useUi } from "../stores/ui";

/** Sidebar + page header + main area + status bar (FP-7). */
export default function AppShell() {
  const sidebarOpen = useUi((s) => s.sidebarOpen);
  const close = () => useUi.setState({ sidebarOpen: false });
  const { pathname } = useLocation();

  useEffect(() => {
    if (!isDesktop()) close(); // on phones, navigating hides the sidebar
  }, [pathname]);

  return (
    <div className="flex h-dvh">
      {sidebarOpen && <div className="fixed inset-0 z-20 bg-black/20 md:hidden" onClick={close} />}
      {sidebarOpen && (
        <aside className="fixed inset-y-0 left-0 z-30 w-[248px] shrink-0 border-r border-line bg-panel md:static dark:border-white/10 dark:bg-[#1c1c1c]">
          <Sidebar />
        </aside>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <OfflineBanner />
        <main className="min-h-0 flex-1 overflow-auto">
          <Outlet />
        </main>
        <StatusBar />
      </div>
      <Toaster />
      <ReauthModal />
    </div>
  );
}
