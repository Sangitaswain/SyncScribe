// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { EditorView } from "@codemirror/view";
import { expect, it } from "vitest";
import * as Y from "yjs";
import MarkdownEditor from "./MarkdownEditor";

// jsdom has no layout engine; CodeMirror only needs these to exist
const rects = () => Object.assign([], { item: () => null }) as unknown as DOMRectList;
Range.prototype.getClientRects = rects;
Range.prototype.getBoundingClientRect = () => new DOMRect();

it("shows the document text and keeps editor and Y.Text in sync", () => {
  const doc = new Y.Doc();
  const ytext = doc.getText("content");
  ytext.insert(0, "# Hello");
  const { container } = render(<MarkdownEditor ytext={ytext} />);
  const view = EditorView.findFromDOM(container.querySelector(".cm-editor") as HTMLElement)!;
  expect(view.state.doc.toString()).toBe("# Hello");

  view.dispatch({ changes: { from: 7, insert: " world" } }); // the user types
  expect(ytext.toString()).toBe("# Hello world");

  ytext.insert(0, "Intro\n"); // a teammate's change arrives
  expect(view.state.doc.toString()).toBe("Intro\n# Hello world");
});

it("undoes only the user's own edits, not a collaborator's (EC14)", async () => {
  const { yUndoManagerKeymap } = await import("y-codemirror.next");
  const run = (key: string, view: EditorView) => yUndoManagerKeymap.find((k) => k.key === key)!.run!(view);

  const doc = new Y.Doc();
  const ytext = doc.getText("content");
  const { container } = render(<MarkdownEditor ytext={ytext} />);
  const view = EditorView.findFromDOM(container.querySelector(".cm-editor") as HTMLElement)!;

  view.dispatch({ changes: { from: 0, insert: "mine" } });
  const teammate = new Y.Doc();
  Y.applyUpdate(teammate, Y.encodeStateAsUpdate(doc));
  teammate.getText("content").insert(4, " theirs");
  Y.applyUpdate(doc, Y.encodeStateAsUpdate(teammate), "remote");
  expect(ytext.toString()).toBe("mine theirs");

  run("Mod-z", view);
  expect(ytext.toString()).toBe(" theirs");
  run("Mod-y", view);
  expect(ytext.toString()).toBe("mine theirs");
});
