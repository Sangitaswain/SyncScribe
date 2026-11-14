// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { expect, it, vi } from "vitest";
import { USER, userDoc } from "@syncscribe/shared";
import DocPage from "./DocPage";
import StatusBar from "../components/StatusBar";
import TopBar from "../components/TopBar";
import { newDocument } from "../crdt/actions";
import { getDoc } from "../crdt/registry";
import { useSession } from "../stores/session";

// No sync server in unit tests
vi.mock("../sync/providers", () => ({ syncWhileOpen: () => () => {} }));

Range.prototype.getClientRects = () => Object.assign([], { item: () => null }) as unknown as DOMRectList;
Range.prototype.getBoundingClientRect = () => new DOMRect();
useSession.setState({ user: { id: "u1", email: "", name: "", color: "", personalWorkspaceId: "w1" } });

it("opens a document with title, editor, preview modes and word count", async () => {
  const id = await newDocument("w1", null, "# Plan\n\none two three", "Trip plan");
  render(
    <MemoryRouter initialEntries={[`/doc/${id}`]}>
      <TopBar />
      <Routes>
        <Route path="/doc/:docId" element={<DocPage />} />
      </Routes>
      <StatusBar />
    </MemoryRouter>,
  );
  expect(((await screen.findByLabelText("Document title")) as HTMLInputElement).value).toBe("Trip plan");
  await waitFor(() => expect(screen.getByText(/4 words · 1 min read/)).toBeTruthy());

  fireEvent.click(screen.getByLabelText("Side by side"));
  await waitFor(() => expect(document.querySelector(".prose h1")?.textContent).toBe("Plan"));
  expect(document.querySelector(".cm-editor")).toBeTruthy();
  expect((await getDoc(userDoc("u1"))).getMap(USER.settings).get("editorMode")).toBe("split");
});
