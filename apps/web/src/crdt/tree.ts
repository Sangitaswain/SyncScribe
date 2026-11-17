import * as Y from "yjs";
import { nanoid } from "nanoid";
import { generateKeyBetween } from "fractional-indexing";
import { DOC, WS } from "@syncscribe/shared";
import { resolveTree } from "./resolveTree";

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
  deletedByName?: string; // shown in "deleted by …" without a network lookup (EC9)
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

/** Restore (H3, DF12): the doc's text becomes `text` as a new change on top, so today's text stays in history. */
export function replaceContent(doc: Y.Doc, text: string) {
  const content = doc.getText(DOC.content);
  doc.transact(() => {
    content.delete(0, content.length);
    content.insert(0, text);
  });
}

export const readItem = (ws: Y.Doc, id: string) => {
  const item = itemsOf(ws).get(id);
  return item ? ({ id, ...item.toJSON() } as TreeItem) : undefined;
};

/** Items below `id` at any depth with the given `deletedAt` (null = live; undefined = all). */
function descendants(ws: Y.Doc, id: string, deletedAt: number | null | undefined = null) {
  const found: [string, Y.Map<unknown>][] = [];
  const seen = new Set([id]);
  for (let i = 0, parents = [id]; i < parents.length; i++)
    for (const [childId, child] of itemsOf(ws))
      if (child.get("parentId") === parents[i] && (deletedAt === undefined || child.get("deletedAt") === deletedAt) && !seen.has(childId)) {
        seen.add(childId);
        found.push([childId, child]);
        parents.push(childId);
      }
  return found;
}

/**
 * Moves an item to Trash; nothing is erased (B10). A folder's contents get the same `deletedAt`,
 * so they come back together on restore.
 */
export function trash(ws: Y.Doc, id: string, userId: string, userName = "") {
  const item = itemsOf(ws).get(id);
  if (!item || item.get("deletedAt")) return;
  const deletedAt = Date.now();
  ws.transact(() => {
    item.set("trashParentId", item.get("parentId"));
    for (const it of [item, ...descendants(ws, id).map(([, d]) => d)]) {
      it.set("deletedAt", deletedAt);
      it.set("deletedBy", userId);
      it.set("deletedByName", userName);
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
    for (const it of [item, ...descendants(ws, id, deletedAt).map(([, d]) => d)]) {
      it.set("deletedAt", null);
      it.set("deletedBy", null);
    }
  });
}

/**
 * EC13: docs I still have unsynced edits in, whose folder someone else put in Trash, move to the top level
 * instead of disappearing with it. Returns how many were moved.
 */
export function rescueEditedDocs(ws: Y.Doc, hasLocalEdits: (docId: string) => boolean, me: string) {
  const items = itemsOf(ws);
  const rescued: Y.Map<unknown>[] = [];
  for (const [id, item] of items) {
    const parent = items.get(item.get("parentId") as string);
    const deletedWithFolder = !!item.get("deletedAt") && parent?.get("deletedAt") === item.get("deletedAt");
    if (item.get("type") === "doc" && deletedWithFolder && item.get("deletedBy") !== me && hasLocalEdits(id)) rescued.push(item);
  }
  if (rescued.length)
    ws.transact(() => {
      for (const item of rescued)
        for (const [k, v] of Object.entries({ parentId: null, order: lastOrder(ws, null), deletedAt: null, deletedBy: null, trashParentId: null }))
          item.set(k, v);
    });
  return rescued.length;
}

/**
 * EC12: two offline moves put folders inside each other. Writes the loop break that every device
 * already computes (the folder with the smallest id goes to the top), so all trees match. Returns their names.
 */
export function fixCycles(ws: Y.Doc) {
  const all = [...itemsOf(ws).keys()].map((id) => readItem(ws, id)!);
  const { broken } = resolveTree(all);
  if (broken.length)
    ws.transact(() => {
      for (const id of broken) move(ws, id, null);
    });
  return broken.map((id) => all.find((i) => i.id === id)?.name || "Untitled folder");
}

/** Removes an item and everything inside it from the tree for good; returns the removed ids (B10, owner only). */
export function purge(ws: Y.Doc, id: string) {
  const ids = [id, ...descendants(ws, id, undefined).map(([childId]) => childId)];
  ws.transact(() => ids.forEach((i) => itemsOf(ws).delete(i)));
  return ids;
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
