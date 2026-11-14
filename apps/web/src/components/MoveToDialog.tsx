import { Folder, Home } from "lucide-react";
import { isInside, type TreeItem } from "../crdt/tree";

/** Pick a destination folder (B5). Excludes the item itself and its descendants. */
export default function MoveToDialog({
  item,
  items,
  onMove,
  onClose,
}: {
  item: TreeItem;
  items: TreeItem[];
  onMove: (parentId: string | null) => void;
  onClose: () => void;
}) {
  const folders = items.filter((i) => i.type === "folder" && !i.deletedAt && !isInside(items, i.id, item.id));
  const option = "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-hover disabled:opacity-40 dark:hover:bg-white/5";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-xs rounded-2xl bg-white p-4 shadow-xl dark:bg-[#1c1c1c]" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-2 font-semibold">Move to…</h2>
        <div className="max-h-72 overflow-y-auto">
          <button className={option} disabled={item.parentId === null} onClick={() => onMove(null)}>
            <Home className="size-4 text-muted" /> Top level
          </button>
          {folders.map((f) => (
            <button key={f.id} className={option} disabled={item.parentId === f.id} onClick={() => onMove(f.id)}>
              <Folder className="size-4 text-muted" /> {f.name || "Untitled folder"}
            </button>
          ))}
        </div>
        <button onClick={onClose} className="mt-3 text-sm text-muted hover:underline">Cancel</button>
      </div>
    </div>
  );
}
