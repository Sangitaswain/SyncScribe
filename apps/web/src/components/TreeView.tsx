import { useState } from "react";
import { Link, useParams } from "react-router";
import { ChevronRight, FileText, Folder, FolderOpen } from "lucide-react";
import { WS, wsDoc } from "@syncscribe/shared";
import { useDoc, useY } from "../crdt/hooks";
import { resolveTree, type SortMode, type TreeNode } from "../crdt/resolveTree";
import type { TreeItem } from "../crdt/tree";
import { useDocTitle, useTitles } from "../crdt/titles";
import { useDocStatus } from "../stores/docStatus";

function DocRow({ item, depth, active }: { item: TreeItem; depth: number; active: boolean }) {
  const title = useDocTitle(item.id);
  const pending = useDocStatus((s) => s[`doc:${item.id}`]?.pending);
  return (
    <Link
      to={`/doc/${item.id}`}
      style={{ paddingLeft: 8 + depth * 14 + 18 }}
      className={`flex items-center gap-1.5 rounded py-1 pr-2 text-sm ${
        active ? "bg-indigo-100 font-medium text-indigo-900 dark:bg-indigo-900/40 dark:text-indigo-100" : "hover:bg-slate-200/70 dark:hover:bg-slate-700"
      }`}
    >
      <FileText className="size-4 shrink-0 text-slate-400" />
      <span className="truncate">{title || "Untitled"}</span>
      {pending && <span className="ml-auto size-1.5 shrink-0 rounded-full bg-amber-500" title="Not synced yet" />}
    </Link>
  );
}

function Node({ node, depth, activeId }: { node: TreeNode; depth: number; activeId?: string }) {
  const [open, setOpen] = useState(true);
  const { item, children } = node;
  if (item.type === "doc") return <DocRow item={item} depth={depth} active={item.id === activeId} />;
  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        style={{ paddingLeft: 8 + depth * 14 }}
        className="flex w-full items-center gap-1 rounded py-1 pr-2 text-left text-sm hover:bg-slate-200/70 dark:hover:bg-slate-700"
        aria-expanded={open}
      >
        <ChevronRight className={`size-3.5 shrink-0 text-slate-400 transition-transform ${open ? "rotate-90" : ""}`} />
        {open ? <FolderOpen className="size-4 shrink-0 text-amber-500" /> : <Folder className="size-4 shrink-0 text-amber-500" />}
        <span className="truncate">{item.name || "Untitled folder"}</span>
      </button>
      {open && children.map((c) => <Node key={c.item.id} node={c} depth={depth + 1} activeId={activeId} />)}
    </div>
  );
}

/** Folder/document tree of one workspace (B4). */
export default function TreeView({ workspaceId, sort = "manual" }: { workspaceId: string; sort?: SortMode }) {
  const { docId } = useParams();
  const ws = useDoc(wsDoc(workspaceId));
  const items = useY<Record<string, Omit<TreeItem, "id">>>(ws?.getMap(WS.items));
  const titles = useTitles();
  if (!items) return null;
  const { roots } = resolveTree(
    Object.entries(items).map(([id, v]) => ({ id, ...v })),
    { sort, nameOf: (i) => (i.type === "doc" ? titles[i.id] ?? "" : i.name ?? "") },
  );
  if (!roots.length) return <p className="px-2 py-1 text-sm text-slate-500">No documents yet</p>;
  return (
    <nav aria-label="Documents">
      {roots.map((n) => (
        <Node key={n.item.id} node={n} depth={0} activeId={docId} />
      ))}
    </nav>
  );
}
