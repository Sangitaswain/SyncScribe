import { Link, useNavigate } from "react-router";
import { FileText, Plus } from "lucide-react";
import { WS, wsDoc } from "@syncscribe/shared";
import { useDoc, useY } from "../crdt/hooks";
import { useDocTitle, useEditedAt } from "../crdt/titles";
import { newDocument } from "../crdt/actions";
import type { TreeItem } from "../crdt/tree";
import { useSession } from "../stores/session";
import { primaryButton } from "../components/ui";

const when = (ms: number) =>
  new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

function DocRow({ item, editedAt }: { item: TreeItem; editedAt: number }) {
  const title = useDocTitle(item.id);
  return (
    <Link to={`/doc/${item.id}`} className="flex items-center gap-3 border-b border-line px-2 py-3 hover:bg-hover dark:border-white/10 dark:hover:bg-white/5">
      <FileText className="size-4 shrink-0 text-muted" />
      <span className="flex-1 truncate text-[14px]">{title || "Untitled"}</span>
      <span className="shrink-0 text-[12px] text-muted">{when(editedAt)}</span>
    </Link>
  );
}

/** Home: every document in the workspace, most recently edited first. */
export default function AllDocsPage() {
  const workspaceId = useSession((s) => s.activeWorkspaceId)!;
  const ws = useDoc(wsDoc(workspaceId));
  const raw = useY<Record<string, Omit<TreeItem, "id">>>(ws?.getMap(WS.items)) ?? {};
  const editedAt = useEditedAt();
  const navigate = useNavigate();
  const docs = Object.entries(raw)
    .map(([id, v]) => ({ id, ...v }))
    .filter((i) => i.type === "doc" && !i.deletedAt)
    .map((item) => ({ item, at: editedAt[item.id] ?? item.createdAt }))
    .sort((a, b) => b.at - a.at);

  return (
    <div className="mx-auto max-w-[800px] px-6 pt-10 pb-16">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-[32px] font-bold tracking-tight">All docs</h1>
        <button className={`${primaryButton} flex items-center gap-1.5`} onClick={async () => navigate(`/doc/${await newDocument(workspaceId, null)}`)}>
          <Plus className="size-4" /> New doc
        </button>
      </div>
      <div className="flex justify-between border-b border-line px-2 pb-2 text-[12px] text-muted dark:border-white/10">
        <span>Title</span>
        <span>Last edited</span>
      </div>
      {docs.length ? docs.map(({ item, at }) => <DocRow key={item.id} item={item} editedAt={at} />) : (
        <p className="px-2 py-10 text-center text-sm text-muted">No documents yet. Create your first one.</p>
      )}
    </div>
  );
}
