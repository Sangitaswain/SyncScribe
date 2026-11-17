import { expect, it } from "vitest";
import * as Y from "yjs";
import { DOC, WS } from "@syncscribe/shared";
import { createDocItem, createFolder, move, readItem, replaceContent, setTitle } from "./tree";

// Two devices editing the same documents offline, then exchanging changes in both orders (FP-18).
// Every scenario must end with identical content on both sides and nothing silently lost.

/** Two copies of one starting state, as two devices have after their last sync. */
function twoDevices(setup: (doc: Y.Doc) => void = () => {}) {
  const a = new Y.Doc();
  setup(a);
  const b = new Y.Doc();
  Y.applyUpdate(b, Y.encodeStateAsUpdate(a));
  return [a, b] as const;
}

/** Both reconnect: each receives what the other did. */
function sync(a: Y.Doc, b: Y.Doc) {
  const toB = Y.encodeStateAsUpdate(a, Y.encodeStateVector(b));
  const toA = Y.encodeStateAsUpdate(b, Y.encodeStateVector(a));
  Y.applyUpdate(b, toB);
  Y.applyUpdate(a, toA);
}

const text = (d: Y.Doc) => d.getText(DOC.content).toString();

it("EC7: both people typing at the exact same spot keep both texts, in the same order everywhere", () => {
  const [a, b] = twoDevices((d) => d.getText(DOC.content).insert(0, "Hello world"));
  a.getText(DOC.content).insert(5, " Priya");
  b.getText(DOC.content).insert(5, " Ali");
  sync(a, b);
  expect(text(a)).toBe(text(b));
  expect(["Hello Priya Ali world", "Hello Ali Priya world"]).toContain(text(a));
});

it("EC8: a paragraph deleted by one person while another edits inside it keeps the new typing", () => {
  const [a, b] = twoDevices((d) => d.getText(DOC.content).insert(0, "Intro.\nOld paragraph here.\nEnd."));
  const start = "Intro.\n".length;
  a.getText(DOC.content).delete(start, "Old paragraph here.\n".length); // Priya deletes the paragraph
  b.getText(DOC.content).insert(start + "Old ".length, "(new note) "); // Ali types inside it
  sync(a, b);
  expect(text(a)).toBe(text(b));
  expect(text(a)).toBe("Intro.\n(new note) End.");
});

it("EC10: two different renames end with the same title on every device", () => {
  const [a, b] = twoDevices((d) => setTitle(d, "Draft"));
  setTitle(a, "Final report");
  setTitle(b, "Group report");
  sync(a, b);
  const title = a.getMap(DOC.meta).get("title");
  expect(b.getMap(DOC.meta).get("title")).toBe(title);
  expect(["Final report", "Group report"]).toContain(title);

  // Folder names follow the same rule
  let folder = "";
  const [x, y] = twoDevices((d) => (folder = createFolder(d, null, "Notes", "u1")));
  x.getMap<Y.Map<unknown>>(WS.items).get(folder)!.set("name", "Lectures");
  y.getMap<Y.Map<unknown>>(WS.items).get(folder)!.set("name", "Seminars");
  sync(x, y);
  expect(readItem(x, folder)!.name).toBe(readItem(y, folder)!.name);
});

it("EC11: an item moved to two different folders ends up in exactly one, never duplicated", () => {
  let doc = "", f1 = "", f2 = "";
  const [a, b] = twoDevices((d) => {
    f1 = createFolder(d, null, "One", "u1");
    f2 = createFolder(d, null, "Two", "u1");
    doc = createDocItem(d, null, "u1");
  });
  move(a, doc, f1);
  move(b, doc, f2);
  sync(a, b);
  expect(readItem(a, doc)!.parentId).toBe(readItem(b, doc)!.parentId);
  expect([f1, f2]).toContain(readItem(a, doc)!.parentId);
  expect([...a.getMap(WS.items).keys()].filter((k) => k === doc)).toHaveLength(1);
});

it("H3: restoring an old version is a new change that merges with edits made meanwhile", () => {
  const [a, b] = twoDevices((d) => d.getText(DOC.content).insert(0, "v2 text"));
  replaceContent(a, "v1 text"); // Priya restores last week's version
  b.getText(DOC.content).insert(0, "Ali: "); // Ali is still typing at the start
  sync(a, b);
  expect(text(a)).toBe(text(b));
  expect(text(a)).toContain("v1 text");
  expect(text(a)).toContain("Ali: "); // the concurrent edit isn't lost
  expect(text(a)).not.toContain("v2 text");
});

it("EC14: undo reverses only my own change, never a collaborator's", () => {
  const [a, b] = twoDevices();
  const mine = a.getText(DOC.content);
  const undo = new Y.UndoManager(mine, { trackedOrigins: new Set(["me"]) });
  a.transact(() => mine.insert(0, "mine "), "me");
  b.getText(DOC.content).insert(0, "theirs ");
  sync(a, b);
  undo.undo();
  expect(text(a)).toBe("theirs ");
});
