import { createContext, useContext, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { ChevronRight, CloudCheck, FileText, Folder, FolderOpen, MoreHorizontal } from "lucide-react";
import type * as Y from "yjs";
import { DndContext, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { WS, docDoc, wsDoc } from "@syncscribe/shared";
import { useDoc, useY } from "../crdt/hooks";
import { getDoc, releaseDoc } from "../crdt/registry";
import { resolveTree, type SortMode, type TreeNode } from "../crdt/resolveTree";
import { dropParent, move, renameFolder, setTitle, trash, type TreeItem } from "../crdt/tree";
import { duplicateDocument } from "../crdt/actions";
import { useDocTitle, useEditedAt, useTitles } from "../crdt/titles";
import { useDocStatus } from "../stores/docStatus";
import { useSession } from "../stores/session";
import { toast, useUi } from "../stores/ui";
import MoveToDialog from "./MoveToDialog";

interface Ctx {
  ws: Y.Doc;
  workspaceId: string;
  items: TreeItem[];
  renaming: string | null;
  setRenaming: (id: string | null) => void;
}
const TreeCtx = createContext<Ctx>(null!);

/** Keeps clicks in menus, dialogs and inputs from opening the row underneath. */
const stop = (e: React.MouseEvent) => {
  e.preventDefault();
  e.stopPropagation();
};

/** Inline rename box; Enter or blur saves, Escape cancels. */
function RenameInput({ initial, onDone }: { initial: string; onDone: (value: string | null) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => ref.current?.select(), []);
  return (
    <input
      ref={ref}
      defaultValue={initial}
      aria-label="New name"
      className="min-w-0 flex-1 rounded border border-brand bg-white px-1 text-sm outline-none dark:bg-[#141414]"
      onBlur={(e) => onDone(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") onDone(null);
      }}
      onClick={stop}
    />
  );
}

/** "⋯" menu (also opens on right-click): rename, move, duplicate, delete. */
function RowMenu({ item, title, open, setOpen }: { item: TreeItem; title: string; open: boolean; setOpen: (o: boolean) => void }) {
  const { ws, workspaceId, items, setRenaming } = useContext(TreeCtx);
  const [moving, setMoving] = useState(false);
  const navigate = useNavigate();
  const { docId } = useParams();
  const userId = useSession((s) => s.user!.id);
  const act = (fn: () => void) => () => {
    setOpen(false);
    fn();
  };
  const itemClass = "block w-full px-3 py-1.5 text-left text-sm hover:bg-hover dark:hover:bg-white/5";
  return (
    <span onClick={stop} className="contents">
      <button
        onClick={() => setOpen(!open)}
        className="ml-auto shrink-0 rounded p-0.5 text-muted opacity-0 group-hover:opacity-100 hover:bg-active focus:opacity-100"
        aria-label={`Actions for ${title}`}
      >
        <MoreHorizontal className="size-4" />
      </button>
      {open && (
        <div className="absolute top-full right-0 z-40 w-40 rounded-lg border border-line bg-white py-1 shadow-lg dark:border-white/10 dark:bg-[#222]">
          <button className={itemClass} onClick={act(() => setRenaming(item.id))}>Rename</button>
          <button className={itemClass} onClick={act(() => setMoving(true))}>Move to…</button>
          <button className={itemClass} onClick={act(() => useUi.setState({ modal: `share:${item.id}` }))}>Share…</button>
          {item.type === "doc" && (
            <button className={itemClass} onClick={act(async () => navigate(`/doc/${await duplicateDocument(workspaceId, item.id)}`))}>
              Duplicate
            </button>
          )}
          <button
            className={`${itemClass} text-rose-600`}
            onClick={act(() => {
              trash(ws, item.id, userId);
              toast(`"${title}" moved to Trash`);
              if (item.id === docId) navigate("/");
            })}
          >
            Delete
          </button>
        </div>
      )}
      {moving && (
        <MoveToDialog
          item={item}
          items={items}
          onClose={() => setMoving(false)}
          onMove={(parentId) => {
            move(ws, item.id, parentId);
            setMoving(false);
          }}
        />
      )}
    </span>
  );
}

function Row({ item, depth, children, after }: { item: TreeItem; depth: number; children: React.ReactNode; after?: React.ReactNode }) {
  const { ws, renaming, setRenaming } = useContext(TreeCtx);
  const [menu, setMenu] = useState(false);
  const docTitle = useDocTitle(item.type === "doc" ? item.id : undefined);
  const title = item.type === "doc" ? docTitle || "Untitled" : item.name || "Untitled folder";

  async function rename(value: string | null) {
    setRenaming(null);
    if (value === null) return;
    if (item.type === "folder") return renameFolder(ws, item.id, value.trim());
    const doc = await getDoc(docDoc(item.id));
    setTitle(doc, value.trim());
    releaseDoc(docDoc(item.id));
  }

  return (
    <div
      className="group relative flex items-center gap-1.5"
      style={{ paddingLeft: 8 + depth * 14 }}
      onContextMenu={(e) => {
        e.preventDefault();
        setMenu(true);
      }}
      onMouseLeave={() => setMenu(false)}
    >
      {children}
      {renaming === item.id ? (
        <RenameInput initial={item.type === "doc" ? docTitle : item.name ?? ""} onDone={rename} />
      ) : (
        <span className="truncate">{title}</span>
      )}
      {after}
      <RowMenu item={item} title={title} open={menu} setOpen={setMenu} />
    </div>
  );
}

const rowClass = (active = false) =>
  `flex h-8 items-center rounded-md pr-1 text-[14px] transition-colors ${
    active ? "bg-active font-medium dark:bg-white/10" : "text-ink/90 hover:bg-hover dark:text-white/85 dark:hover:bg-white/5"
  }`;

function Node({ node, depth, activeId }: { node: TreeNode; depth: number; activeId?: string }) {
  const [open, setOpen] = useState(true);
  const { item, children } = node;
  const pending = useDocStatus((s) => s[`doc:${item.id}`]?.pending);
  const offline = useDocStatus((s) => s[`doc:${item.id}`]?.offlineAvailable);
  const drag = useDraggable({ id: item.id });
  const drop = useDroppable({ id: item.id, disabled: item.type !== "folder" });
  const dragProps = { ref: drag.setNodeRef, ...drag.listeners, ...drag.attributes, style: { opacity: drag.isDragging ? 0.4 : 1 } };

  if (item.type === "doc")
    return (
      <Link to={`/doc/${item.id}`} className={rowClass(item.id === activeId)} {...dragProps}>
        <Row
          item={item}
          depth={depth}
          after={offline && <CloudCheck className="size-3.5 shrink-0 text-muted/60" aria-label="Available offline" />}
        >
          <FileText className="ml-[18px] size-4 shrink-0 text-muted" />
          {pending && <span className="absolute top-1/2 left-1 size-1.5 -translate-y-1/2 rounded-full bg-amber-500" title="Not synced yet" />}
        </Row>
      </Link>
    );
  return (
    <div ref={drop.setNodeRef} className={drop.isOver ? "rounded-md bg-brand/10 ring-2 ring-brand/50" : ""}>
      <div className={rowClass()} onClick={() => setOpen(!open)} aria-expanded={open} {...dragProps} role="button">
        <Row item={item} depth={depth}>
          <ChevronRight className={`size-3.5 shrink-0 text-muted transition-transform ${open ? "rotate-90" : ""}`} />
          {open ? <FolderOpen className="size-4 shrink-0 text-muted" /> : <Folder className="size-4 shrink-0 text-muted" />}
        </Row>
      </div>
      {open && children.map((c) => <Node key={c.item.id} node={c} depth={depth + 1} activeId={activeId} />)}
    </div>
  );
}

/** Folder/document tree of one workspace (B3–B5). */
export default function TreeView({
  workspaceId,
  sort = "manual",
  renaming,
  setRenaming,
}: {
  workspaceId: string;
  sort?: SortMode;
  renaming: string | null;
  setRenaming: (id: string | null) => void;
}) {
  const { docId } = useParams();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const root = useDroppable({ id: "root" });
  const ws = useDoc(wsDoc(workspaceId));
  const raw = useY<Record<string, Omit<TreeItem, "id">>>(ws?.getMap(WS.items));
  const titles = useTitles();
  const editedAt = useEditedAt();
  if (!ws || !raw) return null;
  const items = Object.entries(raw).map(([id, v]) => ({ id, ...v }));
  const { roots } = resolveTree(items, {
    sort,
    nameOf: (i) => (i.type === "doc" ? titles[i.id] ?? "" : i.name ?? ""),
    editedAt: (i) => editedAt[i.id],
  });
  if (!roots.length) return <p className="px-2 py-1 text-[13px] text-muted">No documents yet</p>;

  // Drop on a folder = move into it; drop on empty space = move to top level (B5)
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    const parent = dropParent(items, String(active.id), over ? String(over.id) : null);
    if (parent !== undefined) move(ws, String(active.id), parent);
  };

  return (
    <TreeCtx.Provider value={{ ws, workspaceId, items, renaming, setRenaming }}>
      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <nav aria-label="Documents" ref={root.setNodeRef} className={`min-h-full pb-8 ${root.isOver ? "rounded-md bg-hover" : ""}`}>
          {roots.map((n) => (
            <Node key={n.item.id} node={n} depth={0} activeId={docId} />
          ))}
        </nav>
      </DndContext>
    </TreeCtx.Provider>
  );
}
