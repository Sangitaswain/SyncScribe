import { useSession } from "../stores/session";
import TreeView from "./TreeView";

export default function Sidebar() {
  const { workspaces, activeWorkspaceId } = useSession();
  const ws = workspaces.find((w) => w.id === activeWorkspaceId);
  return (
    <div className="flex h-full flex-col gap-2">
      <p className="truncate px-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">{ws?.name ?? "Workspace"}</p>
      <div className="min-h-0 flex-1 overflow-y-auto">{activeWorkspaceId && <TreeView workspaceId={activeWorkspaceId} />}</div>
    </div>
  );
}
