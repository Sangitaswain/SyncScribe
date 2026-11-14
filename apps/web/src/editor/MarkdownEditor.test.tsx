// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { EditorView } from "@codemirror/view";
import { expect, it } from "vitest";
import * as Y from "yjs";
import MarkdownEditor from "./MarkdownEditor";

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
