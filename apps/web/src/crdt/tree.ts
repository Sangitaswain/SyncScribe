import * as Y from "yjs";
import { nanoid } from "nanoid";
import { generateKeyBetween } from "fractional-indexing";
import { DOC, WS } from "@syncscribe/shared";

// Workspace tree operations (FP-4.2, FP-8.2). Each change is one Yjs transaction, so it is atomic and works offline.

export type ItemType = "folder" | "doc";

export interface TreeItem {
  id: string;
  type: ItemType;
  name?: string; // folders only; doc titles live in doc:{id}.meta.title
  parentId: string | null;
  order: string;
  tags?: string[];
  createdAt: number;
  createdBy: string;
  deletedAt: number | null;
  deletedBy: string | null;
  trashParentId: string | null;
}

export const itemsOf = (ws: Y.Doc) => ws.getMap<Y.Map<unknown>>(WS.items);

/** Order key that places a new item after its current siblings. */
const lastOrder = (ws: Y.Doc, parentId: string | null) => {
  let last: string | null = null;
  for (const item of itemsOf(ws).values()) {
    const o = item.get("order") as string;
    if (item.get("parentId") === parentId && (!last || o > last)) last = o;
  }
  return generateKeyBetween(last, null);
};

function addItem(ws: Y.Doc, type: ItemType, parentId: string | null, userId: string, fields: Record<string, unknown> = {}) {
  const id = nanoid();
  ws.transact(() => {
    const item = new Y.Map<unknown>();
    itemsOf(ws).set(id, item);
    const base = { type, parentId, order: lastOrder(ws, parentId), createdAt: Date.now(), createdBy: userId };
    for (const [k, v] of Object.entries({ ...base, deletedAt: null, deletedBy: null, trashParentId: null, ...fields }))
      item.set(k, v);
    if (type === "doc") item.set("tags", new Y.Array<string>());
  });
  return id;
}

export const createFolder = (ws: Y.Doc, parentId: string | null, name: string, userId: string) =>
  addItem(ws, "folder", parentId, userId, { name });

export const createDocItem = (ws: Y.Doc, parentId: string | null, userId: string) =>
  addItem(ws, "doc", parentId, userId);

/** Fills a new document's metadata and optional starting text. */
export function initDoc(doc: Y.Doc, o: { title: string; workspaceId: string; userId: string; content?: string }) {
  doc.transact(() => {
    const meta = doc.getMap(DOC.meta);
    meta.set("title", o.title);
    meta.set("createdAt", Date.now());
    meta.set("createdBy", o.userId);
    meta.set("workspaceId", o.workspaceId);
    if (o.content) doc.getText(DOC.content).insert(0, o.content);
  });
}

/** Renames a folder (doc titles are renamed with setTitle). Concurrent renames converge (EC10). */
export const renameFolder = (ws: Y.Doc, id: string, name: string) => itemsOf(ws).get(id)?.set("name", name);

export const setTitle = (doc: Y.Doc, title: string) => doc.getMap(DOC.meta).set("title", title);

/** Moves an item under a new parent (null = root). The item exists once, so it can never be duplicated (EC11). */
export function move(ws: Y.Doc, id: string, parentId: string | null, order?: string) {
  const item = itemsOf(ws).get(id);
  if (!item || id === parentId) return;
  ws.transact(() => {
    item.set("parentId", parentId);
    item.set("order", order ?? lastOrder(ws, parentId));
  });
}

export function setTags(ws: Y.Doc, id: string, tags: string[]) {
  const arr = itemsOf(ws).get(id)?.get("tags") as Y.Array<string> | undefined;
  if (!arr) return;
  ws.transact(() => {
    arr.delete(0, arr.length);
    arr.push([...new Set(tags.map((t) => t.trim()).filter(Boolean))]);
  });
}

/** Copies text, title and images of `src` into the empty `dst` (C9). */
export function copyDoc(src: Y.Doc, dst: Y.Doc) {
  dst.transact(() => {
    dst.getText(DOC.content).insert(0, src.getText(DOC.content).toString());
    const meta = dst.getMap(DOC.meta);
    for (const [k, v] of src.getMap(DOC.meta).entries()) meta.set(k, v);
    meta.set("title", `Copy of ${src.getMap(DOC.meta).get("title") || "Untitled"}`);
    meta.set("createdAt", Date.now());
    const assets = dst.getMap(DOC.assets);
    for (const [k, v] of src.getMap(DOC.assets).entries()) assets.set(k, v);
  });
}

export const readItem = (ws: Y.Doc, id: string) => {
  const item = itemsOf(ws).get(id);
  return item ? ({ id, ...item.toJSON() } as TreeItem) : undefined;
};

/** Live (not trashed) items below `id`, at any depth. */
function descendants(ws: Y.Doc, id: string, deletedAt: number | null = null) {
  const found: Y.Map<unknown>[] = [];
  const seen = new Set([id]);
  for (let i = 0, parents = [id]; i < parents.length; i++)
    for (const [childId, child] of itemsOf(ws))
      if (child.get("parentId") === parents[i] && child.get("deletedAt") === deletedAt && !seen.has(childId)) {
        seen.add(childId);
        found.push(child);
        parents.push(childId);
      }
  return found;
}

/**
 * Moves an item to Trash; nothing is erased (B10). A folder's contents get the same `deletedAt`,
 * so they come back together on restore.
 */
export function trash(ws: Y.Doc, id: string, userId: string) {
  const item = itemsOf(ws).get(id);
  if (!item || item.get("deletedAt")) return;
  const deletedAt = Date.now();
  ws.transact(() => {
    item.set("trashParentId", item.get("parentId"));
    for (const it of [item, ...descendants(ws, id)]) {
      it.set("deletedAt", deletedAt);
      it.set("deletedBy", userId);
    }
  });
}

/** Brings an item (and what was trashed with it) back: to its old folder if that still exists, else to the top (4.10). */
export function restore(ws: Y.Doc, id: string) {
  const item = itemsOf(ws).get(id);
  const deletedAt = item?.get("deletedAt") as number | null | undefined;
  if (!item || !deletedAt) return;
  const oldParent = item.get("trashParentId") as string | null;
  const parent = oldParent ? itemsOf(ws).get(oldParent) : undefined;
  ws.transact(() => {
    item.set("parentId", parent && !parent.get("deletedAt") ? oldParent : null);
    item.set("trashParentId", null);
    for (const it of [item, ...descendants(ws, id, deletedAt)]) {
      it.set("deletedAt", null);
      it.set("deletedBy", null);
    }
  });
}

/** Items the user put in Trash themselves (not the contents of a trashed folder), newest first. */
export const trashedItems = (items: TreeItem[]) => {
  const byId = new Map(items.map((i) => [i.id, i]));
  return items
    .filter((i) => i.deletedAt && byId.get(i.parentId ?? "")?.deletedAt !== i.deletedAt)
    .sort((a, b) => b.deletedAt! - a.deletedAt!);
};

/** True if `targetId` is `itemId` itself or somewhere inside it (a folder can't move into its own subtree). */
export function isInside(items: TreeItem[], targetId: string, itemId: string) {
  const byId = new Map(items.map((i) => [i.id, i]));
  for (let cur = byId.get(targetId); cur; cur = cur.parentId ? byId.get(cur.parentId) : undefined)
    if (cur.id === itemId) return true;
  return false;
}

/** Where a drag-and-drop should move an item: a folder id, null for top level, or undefined for "no move". */
export function dropParent(items: TreeItem[], activeId: string, overId: string | null): string | null | undefined {
  const item = items.find((i) => i.id === activeId);
  if (!item || overId === null) return undefined;
  if (overId === "root") return item.parentId === null ? undefined : null;
  const target = items.find((i) => i.id === overId);
  if (target?.type !== "folder" || target.id === item.parentId || isInside(items, target.id, item.id)) return undefined;
  return target.id;
}
