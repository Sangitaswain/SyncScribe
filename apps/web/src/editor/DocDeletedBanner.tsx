import { WS, wsDoc } from "@syncscribe/shared";
import { useDoc, useY } from "../crdt/hooks";
import { restore, type TreeItem } from "../crdt/tree";
import { useSession } from "../stores/session";

/** The open doc was moved to Trash (maybe by someone else): it still works, and can be restored (EC9). */
export default function DocDeletedBanner({ docId }: { docId: string }) {
  const workspaceId = useSession((s) => s.activeWorkspaceId);
  const me = useSession((s) => s.user?.id);
  const ws = useDoc(workspaceId ? wsDoc(workspaceId) : undefined);
  const item = useY<Record<string, TreeItem>>(ws?.getMap(WS.items))?.[docId];
  if (!ws || !item?.deletedAt) return null;

  const by = item.deletedBy === me ? "you" : item.deletedByName || "a collaborator";
  return (
    <div role="status" className="flex shrink-0 items-center gap-3 bg-panel px-4 py-1.5 text-xs text-muted dark:bg-white/5">
      <span className="min-w-0 flex-1">This document was deleted by {by}. Your changes are still saved.</span>
      <button onClick={() => restore(ws, docId)} className="font-medium text-brand hover:underline">
        Restore
      </button>
    </div>
  );
}
