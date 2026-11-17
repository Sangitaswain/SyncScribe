// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation, useParams } from "react-router";
import { EditorView } from "@codemirror/view";
import * as Y from "yjs";
import { wsDoc } from "@syncscribe/shared";
import SearchOverlay from "./SearchPanel";
import MarkdownEditor from "../editor/MarkdownEditor";
import { newDocument } from "../crdt/actions";
import { getDoc } from "../crdt/registry";
import { trash } from "../crdt/tree";
import { buildIndex } from "../services/search";
import { useSession } from "../stores/session";

// No server at all: search runs on the device (I1, I2, 4.11)
Range.prototype.getClientRects = () => Object.assign([], { item: () => null }) as unknown as DOMRectList;
Range.prototype.getBoundingClientRect = () => new DOMRect();
useSession.setState({
  user: { id: "u4", email: "", name: "", color: "", personalWorkspaceId: "w4" },
  workspaces: [{ id: "w4", name: "Mine", kind: "personal", role: "owner" }],
  activeWorkspaceId: "w4",
});

function Opened() {
  const { docId } = useParams();
  return <p>Opened {docId + useLocation().search}</p>;
}
const app = () =>
  render(
    <MemoryRouter>
      <SearchOverlay />
      <Routes>
        <Route path="/" element={<p>Home</p>} />
        <Route path="/doc/:docId" element={<Opened />} />
      </Routes>
    </MemoryRouter>,
  );

it("Cmd+K finds a document by its content and opens it at the match; Trash is left out", async () => {
  const notes = await newDocument("w4", null, "How rivers shape valleys over time.", "Geography notes");
  const old = await newDocument("w4", null, "Old rivers essay", "Draft");
  trash(await getDoc(wsDoc("w4")), old, "u4");
  await buildIndex();
  app();

  fireEvent.keyDown(window, { key: "k", metaKey: true });
  fireEvent.change(await screen.findByLabelText("Search"), { target: { value: "rivers" } });
  await screen.findByText("Geography notes");
  expect(document.querySelector("mark")?.textContent).toBe("rivers");
  expect(screen.queryByText("Draft")).toBeNull();
  fireEvent.keyDown(screen.getByLabelText("Search"), { key: "Enter" });
  await screen.findByText(`Opened ${notes}?find=rivers`);
});

it("Cmd+P opens a document by a fuzzy title (I2)", async () => {
  cleanup();
  app();
  fireEvent.keyDown(window, { key: "p", ctrlKey: true });
  fireEvent.change(await screen.findByLabelText("Quick open"), { target: { value: "geografy" } });
  await screen.findByText("Geography notes");
});

it("the editor selects the match it was opened at", async () => {
  cleanup();
  const ytext = new Y.Doc().getText("content");
  ytext.insert(0, "First line\nSecond line mentions rivers here");
  render(<MarkdownEditor ytext={ytext} find="Rivers" />);
  await waitFor(() => {
    const view = EditorView.findFromDOM(document.querySelector(".cm-editor") as HTMLElement)!;
    const { from, to } = view.state.selection.main;
    expect(view.state.sliceDoc(from, to)).toBe("rivers");
  });
});

it("Cmd+Shift+F also opens search; Cmd+K inside the editor is left to the editor (C5)", async () => {
  const { useUi } = await import("../stores/ui");
  cleanup();
  useUi.setState({ modal: null });
  app();
  const editor = Object.assign(document.createElement("div"), { className: "cm-editor" });
  document.body.append(editor);
  fireEvent.keyDown(editor, { key: "k", metaKey: true });
  expect(useUi.getState().modal).toBeNull();
  fireEvent.keyDown(window, { key: "F", code: "KeyF", metaKey: true, shiftKey: true });
  expect(useUi.getState().modal).toBe("search");
  editor.remove();
});
