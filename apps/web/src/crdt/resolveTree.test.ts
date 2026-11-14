import { expect, it } from "vitest";
import { resolveTree, type TreeNode } from "./resolveTree";
import type { TreeItem } from "./tree";

const item = (id: string, over: Partial<TreeItem> = {}): TreeItem => ({
  id, type: "doc", parentId: null, order: "a0", createdAt: 0, createdBy: "u",
  deletedAt: null, deletedBy: null, trashParentId: null, ...over,
});
const ids = (nodes: TreeNode[]): unknown => nodes.map((n) => (n.children.length ? [n.item.id, ids(n.children)] : n.item.id));

it("nests children, skips deleted items and lifts orphans to root", () => {
  const { roots } = resolveTree([
    item("f", { type: "folder", name: "F" }),
    item("a", { parentId: "f" }),
    item("gone", { deletedAt: 1 }),
    item("orphan", { parentId: "missing" }),
    item("inTrashed", { parentId: "trashed" }),
    item("trashed", { type: "folder", deletedAt: 5 }),
    item("underDoc", { parentId: "a" }), // a doc can't be a parent
  ]);
  expect(ids(roots)).toEqual([["f", ["a"]], "inTrashed", "orphan", "underDoc"]);
});

it("breaks folder cycles the same way on every device (EC12)", () => {
  const items = [
    item("x", { type: "folder", parentId: "y" }),
    item("y", { type: "folder", parentId: "x" }),
    item("d", { parentId: "x" }),
  ];
  const one = resolveTree(items);
  const two = resolveTree([...items].reverse());
  expect(one.broken).toEqual(["x"]);
  expect(ids(one.roots)).toEqual([["x", ["d", "y"]]]);
  expect(ids(two.roots)).toEqual(ids(one.roots));
});

it("sorts by manual order, name, created and edited (folders first)", () => {
  const items = [
    item("b", { order: "a1", name: "beta", createdAt: 2 }),
    item("a", { order: "a2", name: "Alpha", createdAt: 1 }),
    item("f", { type: "folder", order: "a3", name: "zeta", createdAt: 3 }),
  ];
  expect(ids(resolveTree(items).roots)).toEqual(["b", "a", "f"]);
  expect(ids(resolveTree(items, { sort: "name" }).roots)).toEqual(["f", "a", "b"]);
  expect(ids(resolveTree(items, { sort: "created" }).roots)).toEqual(["f", "b", "a"]);
  expect(ids(resolveTree(items, { sort: "edited", editedAt: (i) => (i.id === "a" ? 99 : undefined) }).roots)).toEqual(["f", "a", "b"]);
});
