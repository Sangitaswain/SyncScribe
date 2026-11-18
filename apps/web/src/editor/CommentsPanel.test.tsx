// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { EditorView } from "@codemirror/view";
import { docDoc } from "@syncscribe/shared";
import DocPage from "../routes/DocPage";
import { newDocument } from "../crdt/actions";
import { setDocStatus } from "../stores/docStatus";
import { useSession } from "../stores/session";
import { useUi } from "../stores/ui";

vi.mock("../sync/providers", () => ({ syncWhileOpen: () => () => {} }));
Range.prototype.getClientRects = () => Object.assign([], { item: () => null }) as unknown as DOMRectList;
Range.prototype.getBoundingClientRect = () => new DOMRect();

beforeEach(() => {
  cleanup();
  useSession.setState({ user: { id: "c1", email: "", name: "Cleo", color: "#2563eb", personalWorkspaceId: "wc" } });
  useUi.setState({ commentsOpen: true });
});

async function open(text: string) {
  const id = await newDocument("wc", null, text, "Essay");
  render(
    <MemoryRouter initialEntries={[`/doc/${id}`]}>
      <Routes>
        <Route path="/doc/:docId" element={<DocPage />} />
      </Routes>
    </MemoryRouter>,
  );
  await screen.findByLabelText("Comments", {}, { timeout: 5000 });
  await waitFor(() => expect(document.querySelector(".cm-editor")).toBeTruthy());
  const view = EditorView.findFromDOM(document.querySelector(".cm-editor") as HTMLElement)!;
  return { id, view };
}

it("comments on selected text, replies, resolves and reopens (F4)", async () => {
  const { view } = await open("The river floods every spring.");
  fireEvent.click(screen.getByText("Comment"));
  await screen.findByText("Select some text in the document first.");

  view.dispatch({ selection: { anchor: 4, head: 9 } }); // "river"
  fireEvent.change(screen.getByLabelText("New comment"), { target: { value: "Which river?" } });
  fireEvent.click(screen.getByText("Comment"));
  await screen.findByText("Which river?");
  expect(screen.getByTitle("Show in the document").textContent).toBe("river");

  fireEvent.change(screen.getByLabelText("Reply"), { target: { value: "The Thames." } });
  fireEvent.click(screen.getByText("Reply"));
  await screen.findByText("The Thames.");
  fireEvent.click(screen.getByText("Resolve"));
  await screen.findByText("Reopen");
  fireEvent.click(screen.getByText("Reopen"));
  await screen.findByText("Resolve");

  view.dispatch({ selection: { anchor: 0 } });
  fireEvent.click(screen.getByTitle("Show in the document")); // jumps to the commented words
  expect(view.state.sliceDoc(view.state.selection.main.from, view.state.selection.main.to)).toBe("river");
});

it("commenters can select text but not edit it; viewers only read comments (G5, F4)", async () => {
  const { id, view } = await open("Read me.");
  setDocStatus(docDoc(id), { role: "viewer", canComment: true }); // a commenter: read-only text, comments allowed
  await waitFor(() => expect(document.querySelector(".cm-content")?.getAttribute("contenteditable")).toBe("true"));
  const commenterView = EditorView.findFromDOM(document.querySelector(".cm-editor") as HTMLElement)!;
  expect(commenterView.state.readOnly).toBe(true);
  expect(screen.getByLabelText("New comment")).toBeTruthy();
  expect(view.state.doc.toString()).toBe("Read me.");

  setDocStatus(docDoc(id), { canComment: false }); // a viewer
  await screen.findByText("You can read comments but not add them.");
  await waitFor(() => expect(document.querySelector(".cm-content")?.getAttribute("contenteditable")).toBe("false"));
});
