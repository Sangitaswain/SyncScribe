import { expect, it } from "vitest";
import * as Y from "yjs";
import { DOC } from "@syncscribe/shared";
import { copyDoc, createDocItem, createFolder, initDoc, itemsOf, move, readItem, renameFolder, setTags, setTitle } from "./tree";

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
