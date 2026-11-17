import { useState } from "react";
import { FileText, Folder } from "lucide-react";
import type * as Y from "yjs";
import { WS, cmDoc, docDoc, wsDoc } from "@syncscribe/shared";
import { useDoc, useY } from "../crdt/hooks";
import { deleteLocal } from "../crdt/registry";
import { useDocTitle } from "../crdt/titles";
import { purge, restore, trashedItems, type TreeItem } from "../crdt/tree";
import { clearPending } from "../services/pending";
import { sendOrQueue } from "../services/outbox";
import { useSession } from "../stores/session";
import { toast } from "../stores/ui";

const when = (ms: number) => new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
const link = "text-[13px] font-medium hover:underline";

/** Permanently deletes an item here and on the server (sent later if offline, FP-13). */
async function deleteForever(ws: Y.Doc, item: TreeItem, title: string) {
  for (const id of purge(ws, item.id))
    for (const name of [docDoc(id), cmDoc(id)]) {
      await clearPending(name); // nothing left to upload
      await deleteLocal(name);
    }
  try {
    await sendOrQueue(`Delete "${title}"`, "DELETE", `/docs/${item.id}`);
  } catch (e) {
    toast((e as Error).message, "error");
  }
}

function Row({ item, ws, canPurge }: { item: TreeItem; ws: Y.Doc; canPurge: boolean }) {
  const [confirming, setConfirming] = useState(false);
  const docTitle = useDocTitle(item.type === "doc" ? item.id : undefined);
  const title = item.type === "doc" ? docTitle || "Untitled" : item.name || "Untitled folder";
  const Icon = item.type === "doc" ? FileText : Folder;
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-line px-2 py-3 dark:border-white/10">
      <Icon className="size-4 shrink-0 text-muted" />
      <span className="min-w-0 flex-1 truncate text-[14px]">{title}</span>
      {confirming ? (
        <>
          <span className="text-[13px] text-muted">Delete forever? This can't be undone.</span>
          <button onClick={() => deleteForever(ws, item, title)} className={`${link} text-rose-600`}>
            Delete
          </button>
          <button onClick={() => setConfirming(false)} className={`${link} text-muted`}>
            Cancel
          </button>
        </>
      ) : (
        <>
          <span className="shrink-0 text-[12px] text-muted">Deleted {when(item.deletedAt!)}</span>
          <button onClick={() => restore(ws, item.id)} className={`${link} text-brand`}>
            Restore
          </button>
          {canPurge && (
            <button onClick={() => setConfirming(true)} className={`${link} text-rose-600`}>
              Delete permanently
            </button>
          )}
        </>
      )}
    </div>
  );
}

/** Deleted documents and folders of this workspace; restoring works offline (B10, 4.10). */
export default function TrashPage() {
  const workspaceId = useSession((s) => s.activeWorkspaceId)!;
  const userId = useSession((s) => s.user?.id);
  // Owners delete permanently: the workspace owner or whoever created the item (the server checks again)
  const ownsWorkspace = useSession((s) => s.workspaces.find((w) => w.id === workspaceId)?.role === "owner");
  const ws = useDoc(wsDoc(workspaceId));
  const raw = useY<Record<string, Omit<TreeItem, "id">>>(ws?.getMap(WS.items)) ?? {};
  const items = trashedItems(Object.entries(raw).map(([id, v]) => ({ id, ...v })));

  return (
    <div className="mx-auto max-w-[800px] px-6 pt-10 pb-16">
      <h1 className="mb-1 text-[32px] font-bold tracking-tight">Trash</h1>
      <p className="mb-6 text-sm text-muted">Items in Trash are deleted permanently after 30 days.</p>
      {ws && items.length ? (
        items.map((item) => <Row key={item.id} item={item} ws={ws} canPurge={ownsWorkspace || item.createdBy === userId} />)
      ) : (
        <p className="px-2 py-10 text-center text-sm text-muted">Trash is empty.</p>
      )}
    </div>
  );
}
