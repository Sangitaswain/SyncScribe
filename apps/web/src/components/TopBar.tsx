import { Menu, NotebookPen } from "lucide-react";
import { Link } from "react-router";

export default function TopBar({ onMenu }: { onMenu: () => void }) {
  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b border-slate-200 px-3 dark:border-slate-700">
      <button onClick={onMenu} className="rounded p-1 hover:bg-slate-100 md:hidden dark:hover:bg-slate-800" aria-label="Toggle sidebar">
        <Menu className="size-5" />
      </button>
      <Link to="/" className="flex items-center gap-2 font-semibold">
        <NotebookPen className="size-5 text-indigo-600" /> SyncScribe
      </Link>
      <div className="ml-auto flex items-center gap-2">{/* sync status, presence, share, notifications, user menu */}</div>
    </header>
  );
}
