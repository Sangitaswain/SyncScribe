import { FileText, Folder } from "lucide-react";
import { WS, wsDoc } from "@syncscribe/shared";
import { useDoc, useY } from "../crdt/hooks";
import { useDocTitle } from "../crdt/titles";
import { restore, trashedItems, type TreeItem } from "../crdt/tree";
import { useSession } from "../stores/session";

const when = (ms: number) => new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

function Title({ item }: { item: TreeItem }) {
  const title = useDocTitle(item.type === "doc" ? item.id : undefined);
  return <span className="flex-1 truncate text-[14px]">{item.type === "doc" ? title || "Untitled" : item.name || "Untitled folder"}</span>;
}

/** Deleted documents and folders of this workspace; restoring works offline (B10, 4.10). */
export default function TrashPage() {
  const workspaceId = useSession((s) => s.activeWorkspaceId)!;
  const ws = useDoc(wsDoc(workspaceId));
  const raw = useY<Record<string, Omit<TreeItem, "id">>>(ws?.getMap(WS.items)) ?? {};
  const items = trashedItems(Object.entries(raw).map(([id, v]) => ({ id, ...v })));

  return (
    <div className="mx-auto max-w-[800px] px-6 pt-10 pb-16">
      <h1 className="mb-1 text-[32px] font-bold tracking-tight">Trash</h1>
      <p className="mb-6 text-sm text-muted">Items in Trash are deleted permanently after 30 days.</p>
      {items.length ? (
        items.map((item) => {
          const Icon = item.type === "doc" ? FileText : Folder;
          return (
            <div key={item.id} className="flex items-center gap-3 border-b border-line px-2 py-3 dark:border-white/10">
              <Icon className="size-4 shrink-0 text-muted" />
              <Title item={item} />
              <span className="shrink-0 text-[12px] text-muted">Deleted {when(item.deletedAt!)}</span>
              <button onClick={() => ws && restore(ws, item.id)} className="text-[13px] font-medium text-brand hover:underline">
                Restore
              </button>
            </div>
          );
        })
      ) : (
        <p className="px-2 py-10 text-center text-sm text-muted">Trash is empty.</p>
      )}
    </div>
  );
}
