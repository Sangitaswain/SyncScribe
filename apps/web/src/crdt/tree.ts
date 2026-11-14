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

/** Moves an item to Trash; nothing is erased (B10). Full trash/restore arrives in Step 14. */
export function trash(ws: Y.Doc, id: string, userId: string) {
  const item = itemsOf(ws).get(id);
  if (!item) return;
  ws.transact(() => {
    item.set("trashParentId", item.get("parentId"));
    item.set("deletedAt", Date.now());
    item.set("deletedBy", userId);
  });
}
