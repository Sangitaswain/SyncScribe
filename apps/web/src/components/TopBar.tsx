import { LogOut, Menu, NotebookPen } from "lucide-react";
import { Link } from "react-router";
import { useSession } from "../stores/session";
import { clearSession } from "../services/session";

export default function TopBar({ onMenu }: { onMenu: () => void }) {
  const user = useSession((s) => s.user);
  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b border-slate-200 px-3 dark:border-slate-700">
      <button onClick={onMenu} className="rounded p-1 hover:bg-slate-100 md:hidden dark:hover:bg-slate-800" aria-label="Toggle sidebar">
        <Menu className="size-5" />
      </button>
      <Link to="/" className="flex items-center gap-2 font-semibold">
        <NotebookPen className="size-5 text-indigo-600" /> SyncScribe
      </Link>
      <div className="ml-auto flex items-center gap-2">
        {/* sync status, presence, share, notifications go here */}
        {user && (
          <>
            <Link
              to="/settings"
              className="flex size-7 items-center justify-center rounded-full text-xs font-semibold text-white"
              style={{ backgroundColor: user.color }}
              title={`${user.name} — Settings`}
            >
              {user.name.slice(0, 1).toUpperCase()}
            </Link>
            {/* Simple sign-out for now; the safe sign-out dialog comes in 13.10 */}
            <button onClick={clearSession} className="rounded p-1 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Sign out" title="Sign out">
              <LogOut className="size-4" />
            </button>
          </>
        )}
      </div>
    </header>
  );
}
