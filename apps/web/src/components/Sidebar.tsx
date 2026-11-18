import { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router";
import { Files, FolderPlus, LogOut, PanelLeftClose, Plus, Search, Settings, Trash2, Users } from "lucide-react";
import { WS, wsDoc } from "@syncscribe/shared";
import { useSession } from "../stores/session";
import { useUi } from "../stores/ui";
import { getDoc } from "../crdt/registry";
import { createFolder } from "../crdt/tree";
import { newDocument } from "../crdt/actions";
import { setSetting, usePrefs } from "../crdt/prefs";
import TreeView from "./TreeView";
import SortMenu from "./SortMenu";
import TagFilter from "./TagFilter";
import { useDoc, useY } from "../crdt/hooks";
import { allTags, type TreeItem } from "../crdt/tree";
import DocSection from "./RecentSection";
import WorkspaceSwitcher from "./WorkspaceSwitcher";
import { rowClass } from "./ui";

function NavItem({ to, icon: Icon, label, hint }: { to: string; icon: typeof Files; label: string; hint?: string }) {
  return (
    <NavLink to={to} end className={({ isActive }) => rowClass(isActive)}>
      <Icon className="size-4 text-muted" />
      <span className="flex-1">{label}</span>
      {hint && <kbd className="text-[11px] text-muted">{hint}</kbd>}
    </NavLink>
  );
}

export const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <p className="px-2 text-[12px] font-medium text-muted">{children}</p>
);

/** Workspace switcher, navigation, recent docs, folder tree, trash and profile. */
export default function Sidebar() {
  const { activeWorkspaceId, user } = useSession();
  const [renaming, setRenaming] = useState<string | null>(null);
  const { doc: prefs, pins, recents, settings } = usePrefs();
  const navigate = useNavigate();
  const tag = useUi((s) => s.tagFilter);
  const ws = useDoc(activeWorkspaceId ? wsDoc(activeWorkspaceId) : undefined);
  const items = useY<Record<string, Omit<TreeItem, "id">>>(ws?.getMap(WS.items)) ?? {};
  const tags = allTags(Object.entries(items).map(([id, v]) => ({ id, ...v })));
  // Cmd/Ctrl+Alt+N makes a new document (C5)
  useEffect(() => {
    const onKey = async (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || !e.altKey || e.code !== "KeyN" || !activeWorkspaceId) return;
      e.preventDefault();
      navigate(`/doc/${await newDocument(activeWorkspaceId, null)}`);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeWorkspaceId, navigate]);

  if (!activeWorkspaceId || !user) return null;

  const newDoc = async () => navigate(`/doc/${await newDocument(activeWorkspaceId, null)}`);
  const newFolder = async () => setRenaming(createFolder(await getDoc(wsDoc(activeWorkspaceId)), null, "New folder", user.id));
  const iconButton = "rounded-md p-1 text-muted hover:bg-hover hover:text-ink dark:hover:bg-white/5";

  return (
    <div className="flex h-full flex-col gap-4 p-2">
      <div className="flex items-center gap-1">
        <WorkspaceSwitcher />
        <button onClick={() => useUi.setState({ sidebarOpen: false })} className={iconButton} aria-label="Collapse sidebar" title="Collapse sidebar">
          <PanelLeftClose className="size-4" />
        </button>
      </div>

      <nav className="flex flex-col gap-0.5">
        <NavItem to="/search" icon={Search} label="Search" hint="⌘K" />
        <NavItem to="/" icon={Files} label="All docs" />
        <NavItem to="/shared" icon={Users} label="Shared with me" />
        <NavItem to="/settings" icon={Settings} label="Settings" />
        <button onClick={newDoc} className={rowClass()}>
          <Plus className="size-4 text-muted" /> New doc
        </button>
      </nav>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
        <DocSection title="Pinned" workspaceId={activeWorkspaceId} ids={pins} />
        <DocSection title="Recent" workspaceId={activeWorkspaceId} ids={recents.map((r) => r.docId)} limit={5} />
        <section className="flex flex-1 flex-col gap-1">
          <div className="flex items-center justify-between pr-1">
            <SectionTitle>Organize</SectionTitle>
            <div className="flex items-center gap-1">
              <TagFilter tags={tags} value={tag} onChange={(t) => useUi.setState({ tagFilter: t })} />
              <SortMenu value={settings.sort ?? "manual"} onChange={(m) => prefs && setSetting(prefs, "sort", m)} />
              <button onClick={newFolder} className={iconButton} aria-label="New folder" title="New folder">
                <FolderPlus className="size-3.5" />
              </button>
            </div>
          </div>
          <TreeView
            workspaceId={activeWorkspaceId}
            sort={settings.sort ?? "manual"}
            renaming={renaming}
            setRenaming={setRenaming}
            tag={tag && tags.includes(tag) ? tag : null}
          />
        </section>
      </div>

      <div className="flex flex-col gap-0.5 border-t border-line pt-2 dark:border-white/10">
        <NavItem to="/trash" icon={Trash2} label="Trash" />
        <div className={rowClass()}>
          <span className="flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white" style={{ backgroundColor: user.color }}>
            {user.name.slice(0, 1).toUpperCase()}
          </span>
          <span className="flex-1 truncate">{user.name}</span>
          <button onClick={() => useUi.setState({ modal: "signout" })} className={iconButton} aria-label="Sign out" title="Sign out">
            <LogOut className="size-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
