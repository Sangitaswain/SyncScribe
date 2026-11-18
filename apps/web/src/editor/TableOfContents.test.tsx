// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { EditorView } from "@codemirror/view";
import { DOC, docDoc } from "@syncscribe/shared";
import DocPage from "../routes/DocPage";
import { newDocument } from "../crdt/actions";
import { getDoc } from "../crdt/registry";
import { headingsOf } from "../lib/headings";
import { useSession } from "../stores/session";
import { useUi } from "../stores/ui";

vi.mock("../sync/providers", () => ({ syncWhileOpen: () => () => {} }));
Range.prototype.getClientRects = () => Object.assign([], { item: () => null }) as unknown as DOMRectList;
Range.prototype.getBoundingClientRect = () => new DOMRect();

it("finds headings but not lines inside code blocks", () => {
  expect(headingsOf("# Title\ntext\n## Part one ##\n```\n# not a heading\n```\n### Deep")).toEqual([
    { level: 1, text: "Title", from: 0 },
    { level: 2, text: "Part one", from: 13 },
    { level: 3, text: "Deep", from: 52 },
  ]);
});

it("lists headings while typing and jumps to one (C13)", async () => {
  useSession.setState({ user: { id: "t1", email: "", name: "", color: "", personalWorkspaceId: "wt" } });
  useUi.setState({ tocOpen: true });
  const id = await newDocument("wt", null, "# Intro\nHello\n## Method\nSteps", "Report");
  render(
    <MemoryRouter initialEntries={[`/doc/${id}`]}>
      <Routes>
        <Route path="/doc/:docId" element={<DocPage />} />
      </Routes>
    </MemoryRouter>,
  );
  const contents = await screen.findByLabelText("Contents", {}, { timeout: 5000 });
  await within(contents).findByText("Method");

  const doc = await getDoc(docDoc(id));
  act(() => doc.getText(DOC.content).insert(doc.getText(DOC.content).length, "\n## Results"));
  await waitFor(() => expect(contents.textContent).toContain("Results"));

  fireEvent.click(within(contents).getByRole("button", { name: "Method" }));
  const view = EditorView.findFromDOM(document.querySelector(".cm-editor") as HTMLElement)!;
  const sel = view.state.selection.main;
  expect(view.state.sliceDoc(sel.from, sel.to)).toBe("## Method");
});
