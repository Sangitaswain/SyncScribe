import { useState } from "react";
import { Outlet } from "react-router";
import TopBar from "./TopBar";
import StatusBar from "./StatusBar";
import Toaster from "./Toaster";

/** Sidebar + top bar + main area + status bar (FP-7). */
export default function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  return (
    <div className="flex h-dvh bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100">
      {sidebarOpen && (
        <div className="fixed inset-0 z-20 bg-black/30 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-30 w-64 shrink-0 border-r border-slate-200 bg-slate-50 p-3 transition-transform md:static md:translate-x-0 dark:border-slate-700 dark:bg-slate-800 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <p className="text-sm text-slate-500">Documents</p>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar onMenu={() => setSidebarOpen((o) => !o)} />
        <main className="min-h-0 flex-1 overflow-auto">
          <Outlet />
        </main>
        <StatusBar />
      </div>
      <Toaster />
    </div>
  );
}
