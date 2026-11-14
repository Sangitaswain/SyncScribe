import { useState } from "react";
import { useNavigate } from "react-router";
import { FilePlus, FolderPlus } from "lucide-react";
import { wsDoc } from "@syncscribe/shared";
import { useSession } from "../stores/session";
import { getDoc } from "../crdt/registry";
import { createFolder } from "../crdt/tree";
import { newDocument } from "../crdt/actions";
import TreeView from "./TreeView";
import SortMenu from "./SortMenu";
import RecentSection from "./RecentSection";
import { setSetting, usePrefs } from "../crdt/prefs";

export default function Sidebar() {
  const { workspaces, activeWorkspaceId, user } = useSession();
  const [renaming, setRenaming] = useState<string | null>(null);
  const { doc: prefs, recents, settings } = usePrefs();
  const navigate = useNavigate();
  const ws = workspaces.find((w) => w.id === activeWorkspaceId);
  if (!activeWorkspaceId || !user) return null;

  const button = "flex flex-1 items-center justify-center gap-1.5 rounded-md border border-slate-300 px-2 py-1.5 text-xs font-medium hover:bg-white dark:border-slate-600 dark:hover:bg-slate-700";
  return (
    <div className="flex h-full flex-col gap-2">
      <p className="truncate px-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">{ws?.name ?? "Workspace"}</p>
      <div className="flex gap-2 px-1">
        <button className={button} onClick={async () => navigate(`/doc/${await newDocument(activeWorkspaceId, null)}`)}>
          <FilePlus className="size-4" /> New doc
        </button>
        <button
          className={button}
          onClick={async () => setRenaming(createFolder(await getDoc(wsDoc(activeWorkspaceId)), null, "New folder", user.id))}
        >
          <FolderPlus className="size-4" /> New folder
        </button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
        <RecentSection workspaceId={activeWorkspaceId} recents={recents} />
        <section className="flex-1">
          <div className="flex items-center justify-between px-2 pb-1">
            <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Documents</p>
            <SortMenu value={settings.sort ?? "manual"} onChange={(m) => prefs && setSetting(prefs, "sort", m)} />
          </div>
          <TreeView workspaceId={activeWorkspaceId} sort={settings.sort ?? "manual"} renaming={renaming} setRenaming={setRenaming} />
        </section>
      </div>
    </div>
  );
}
