import { expect, it } from "vitest";
import * as Y from "yjs";
import { DOC } from "@syncscribe/shared";
import { copyDoc, createDocItem, createFolder, initDoc, itemsOf, move, readItem, renameFolder, purge, rescueEditedDocs, restore, setTags, setTitle, trash, trashedItems, type TreeItem } from "./tree";

it("creates folders and docs in order under a parent", () => {
  const ws = new Y.Doc();
  const f = createFolder(ws, null, "Reports", "u1");
  const a = createDocItem(ws, f, "u1");
  const b = createDocItem(ws, f, "u1");
  expect(readItem(ws, f)).toMatchObject({ type: "folder", name: "Reports", parentId: null, deletedAt: null });
  expect(readItem(ws, a)).toMatchObject({ type: "doc", parentId: f, tags: [] });
  expect(readItem(ws, a)!.order < readItem(ws, b)!.order).toBe(true);
});

it("renames, moves and tags", () => {
  const ws = new Y.Doc();
  const f = createFolder(ws, null, "Old", "u1");
  const d = createDocItem(ws, null, "u1");
  renameFolder(ws, f, "New");
  move(ws, d, f);
  move(ws, f, f); // ignored: a folder can't contain itself
  setTags(ws, d, ["uni", " uni ", "", "draft"]);
  expect(readItem(ws, f)).toMatchObject({ name: "New", parentId: null });
  expect(readItem(ws, d)).toMatchObject({ parentId: f, tags: ["uni", "draft"] });
});

it("converges when two devices move the same doc offline (EC11)", () => {
  const a = new Y.Doc();
  const d = createDocItem(a, null, "u1");
  const f1 = createFolder(a, null, "F1", "u1");
  const f2 = createFolder(a, null, "F2", "u1");
  const b = new Y.Doc();
  Y.applyUpdate(b, Y.encodeStateAsUpdate(a));

  move(a, d, f1);
  move(b, d, f2);
  Y.applyUpdate(a, Y.encodeStateAsUpdate(b));
  Y.applyUpdate(b, Y.encodeStateAsUpdate(a));

  expect(readItem(a, d)!.parentId).toBe(readItem(b, d)!.parentId);
  expect(itemsOf(a).size).toBe(3); // never duplicated
});

it("initialises, retitles and duplicates documents", () => {
  const src = new Y.Doc();
  initDoc(src, { title: "Plan", workspaceId: "w1", userId: "u1", content: "# Hello" });
  setTitle(src, "Plan v2");
  const dst = new Y.Doc();
  copyDoc(src, dst);
  expect(dst.getText(DOC.content).toString()).toBe("# Hello");
  expect(dst.getMap(DOC.meta).get("title")).toBe("Copy of Plan v2");
});

it("decides drag-and-drop targets", async () => {
  const { dropParent } = await import("./tree");
  const ws = new Y.Doc();
  const outer = createFolder(ws, null, "Outer", "u1");
  const inner = createFolder(ws, outer, "Inner", "u1");
  const doc = createDocItem(ws, null, "u1");
  const items = [...itemsOf(ws).keys()].map((id) => readItem(ws, id)!);

  expect(dropParent(items, doc, inner)).toBe(inner); // into a folder
  expect(dropParent(items, doc, "root")).toBeUndefined(); // already at top level
  expect(dropParent(items, inner, "root")).toBeNull(); // out to top level
  expect(dropParent(items, outer, inner)).toBeUndefined(); // not into its own subfolder
  expect(dropParent(items, doc, doc)).toBeUndefined(); // onto a doc: no move
  expect(dropParent(items, doc, null)).toBeUndefined(); // dropped outside
});

it("trashes a folder with everything in it and restores it together (B10, 4.10)", async () => {
  const ws = new Y.Doc();
  const top = createFolder(ws, null, "Course", "u1");
  const sub = createFolder(ws, top, "Week 1", "u1");
  const doc = createDocItem(ws, sub, "u1");
  const loose = createDocItem(ws, top, "u1");
  trash(ws, loose, "u1"); // trashed on its own first
  await new Promise((r) => setTimeout(r, 2));
  trash(ws, top, "u2");

  const all = () => [...itemsOf(ws).keys()].map((id) => readItem(ws, id)!) as TreeItem[];
  expect(readItem(ws, doc)!.deletedAt).toBe(readItem(ws, top)!.deletedAt);
  expect(readItem(ws, sub)).toMatchObject({ deletedBy: "u2", parentId: top });
  expect(trashedItems(all()).map((i) => i.id)).toEqual([top, loose]); // what the user deleted, newest first

  restore(ws, top);
  for (const id of [top, sub, doc]) expect(readItem(ws, id)!.deletedAt).toBeNull();
  expect(readItem(ws, doc)!.parentId).toBe(sub);
  expect(readItem(ws, loose)!.deletedAt).not.toBeNull(); // trashed separately, stays in Trash
});

it("restores to the top level when the original folder is gone (4.10 step 3)", () => {
  const ws = new Y.Doc();
  const folder = createFolder(ws, null, "Drafts", "u1");
  const doc = createDocItem(ws, folder, "u1");
  trash(ws, doc, "u1");
  trash(ws, folder, "u1");
  restore(ws, doc);
  expect(readItem(ws, doc)).toMatchObject({ parentId: null, deletedAt: null, trashParentId: null });

  const other = createDocItem(ws, null, "u1");
  const keep = createFolder(ws, null, "Kept", "u1");
  move(ws, other, keep);
  trash(ws, other, "u1");
  restore(ws, other);
  expect(readItem(ws, other)!.parentId).toBe(keep); // its folder still exists
});

it("purge removes an item and everything inside it from the tree", () => {
  const ws = new Y.Doc();
  const folder = createFolder(ws, null, "Gone", "u1");
  const doc = createDocItem(ws, folder, "u1");
  const keep = createDocItem(ws, null, "u1");
  expect(purge(ws, folder).sort()).toEqual([folder, doc].sort());
  expect([...itemsOf(ws).keys()]).toEqual([keep]);
});

it("keeps docs I edited when someone else trashes their folder (EC13)", () => {
  const ws = new Y.Doc();
  const folder = createFolder(ws, null, "Shared", "me");
  const edited = createDocItem(ws, folder, "me");
  const untouched = createDocItem(ws, folder, "me");
  const mine = createDocItem(ws, null, "me");
  trash(ws, folder, "them", "Them");
  trash(ws, mine, "them", "Them"); // deleted on its own, not with a folder: the banner handles that (EC9)
  const edits = (id: string) => id === edited || id === mine;

  expect(rescueEditedDocs(ws, edits, "me")).toBe(1);
  expect(readItem(ws, edited)).toMatchObject({ parentId: null, deletedAt: null });
  expect(readItem(ws, untouched)!.deletedAt).not.toBeNull();
  expect(readItem(ws, mine)!.deletedAt).not.toBeNull();

  const own = createFolder(ws, null, "Mine", "me");
  const doc = createDocItem(ws, own, "me");
  trash(ws, own, "me");
  expect(rescueEditedDocs(ws, (id) => id === doc, "me")).toBe(0); // I deleted it myself
  expect(readItem(ws, doc)!.deletedAt).not.toBeNull();
});
