import { expect, it } from "vitest";
import * as Y from "yjs";
import { DOC } from "@syncscribe/shared";
import { addReply, addThread, anchorOf, listThreads, setResolved } from "./comments";

const sync = (a: Y.Doc, b: Y.Doc) => {
  Y.applyUpdate(b, Y.encodeStateAsUpdate(a, Y.encodeStateVector(b)));
  Y.applyUpdate(a, Y.encodeStateAsUpdate(b, Y.encodeStateVector(a)));
};
const priya = { id: "p", name: "Priya" };
const ali = { id: "a", name: "Ali" };

it("a comment made offline stays on its words while others edit, and syncs (F4)", () => {
  // Device A (editor) and device B (commenter), same doc and comments
  const [docA, docB, cmA, cmB] = [new Y.Doc(), new Y.Doc(), new Y.Doc(), new Y.Doc()];
  docA.getText(DOC.content).insert(0, "Floods change how rivers shape valleys.");
  sync(docA, docB);

  // Offline: Ali comments on "rivers" while Priya adds text before it
  const at = "Floods change how ".length;
  const id = addThread(cmB, docB, at, at + "rivers".length, "Which rivers?", ali);
  docA.getText(DOC.content).insert(0, "Intro. ");
  docA.getText(DOC.content).delete("Intro. Floods change how ".length - 4, 4); // "how " removed

  sync(docA, docB);
  sync(cmA, cmB);
  for (const [doc, cm] of [[docA, cmA], [docB, cmB]] as const) {
    const range = anchorOf(cm, doc, id)!;
    expect(doc.getText(DOC.content).toString().slice(range.from, range.to)).toBe("rivers");
  }
  expect(listThreads(cmA)).toMatchObject([{ id, quote: "rivers", resolved: false, replies: [{ body: "Which rivers?", authorName: "Ali" }] }]);

  // Reply, resolve and reopen sync too
  addReply(cmA, id, "The Thames and the Nile.", priya);
  setResolved(cmA, id, true);
  sync(cmA, cmB);
  expect(listThreads(cmB)[0]).toMatchObject({ resolved: true, replies: [{ authorName: "Ali" }, { authorName: "Priya" }] });
  setResolved(cmB, id, false);
  sync(cmA, cmB);
  expect(listThreads(cmA)[0].resolved).toBe(false);
});

it("a thread whose text was deleted has no anchor, but keeps its quote", () => {
  const [doc, cm] = [new Y.Doc(), new Y.Doc()];
  doc.getText(DOC.content).insert(0, "keep this, drop that");
  const id = addThread(cm, doc, 11, 20, "Remove?", priya);
  doc.getText(DOC.content).delete(9, 11);
  expect(anchorOf(cm, doc, id)).toBeNull();
  expect(listThreads(cm)[0].quote).toBe("drop that");
});
