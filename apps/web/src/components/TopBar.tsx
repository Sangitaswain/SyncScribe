import { History, PanelLeft, UserPlus } from "lucide-react";
import { Link, useMatch } from "react-router";
import { useUi } from "../stores/ui";
import { useSession } from "../stores/session";
import { useDocTitle } from "../crdt/titles";
import { setSetting, usePrefs } from "../crdt/prefs";
import ModeSwitch from "../editor/ModeSwitch";
import SyncStatusBadge from "./SyncStatusBadge";
import PresenceAvatars from "./PresenceAvatars";

const PAGE_TITLES: Record<string, string> = { "/": "All docs", "/trash": "Trash", "/shared": "Shared with me", "/search": "Search", "/settings": "Settings" };

function DocCrumb({ id }: { id: string }) {
  return <>{useDocTitle(id) || "Untitled"}</>;
}

/** Page header: sidebar toggle, where you are, and page actions (view mode on documents). */
export default function TopBar() {
  const sidebarOpen = useUi((s) => s.sidebarOpen);
  const docMatch = useMatch("/doc/:docId");
  const page = useMatch("/:page")?.pathname ?? "/";
  const ws = useSession((s) => s.workspaces.find((w) => w.id === s.activeWorkspaceId));
  const { doc: prefs, settings } = usePrefs();
  const docId = docMatch?.params.docId;

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 px-3">
      <button
        onClick={() => useUi.setState({ sidebarOpen: !sidebarOpen })}
        className={`rounded-md p-1.5 text-muted hover:bg-hover hover:text-ink dark:hover:bg-white/5 ${sidebarOpen ? "md:hidden" : ""}`}
        aria-label="Toggle sidebar"
        title="Toggle sidebar"
      >
        <PanelLeft className="size-[18px]" />
      </button>
      <nav className="flex min-w-0 items-center gap-1.5 text-sm" aria-label="Breadcrumb">
        {docId ? (
          <>
            <span className="hidden shrink-0 text-muted sm:inline">{ws?.name}</span>
            <span className="hidden text-muted/60 sm:inline">/</span>
            <span className="truncate font-medium">
              <DocCrumb id={docId} />
            </span>
          </>
        ) : (
          <span className="font-medium">{PAGE_TITLES[page] ?? ""}</span>
        )}
      </nav>
      <div className="ml-auto flex items-center gap-2">
        {docId && <PresenceAvatars />}
        <SyncStatusBadge />
        {docId && (
          <button
            onClick={() => useUi.setState({ modal: `share:${docId}` })}
            className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-muted hover:bg-hover hover:text-ink dark:hover:bg-white/5 dark:hover:text-white"
          >
            <UserPlus className="size-4" />
            <span className="hidden sm:inline">Share</span>
          </button>
        )}
        {docId && (
          <Link
            to={`/doc/${docId}/history`}
            aria-label="Version history"
            title="Version history"
            className="rounded-md p-1.5 text-muted hover:bg-hover hover:text-ink dark:hover:bg-white/5 dark:hover:text-white"
          >
            <History className="size-4" />
          </Link>
        )}
        {docId && <ModeSwitch value={settings.editorMode ?? "edit"} onChange={(m) => prefs && setSetting(prefs, "editorMode", m)} />}
      </div>
    </header>
  );
}
