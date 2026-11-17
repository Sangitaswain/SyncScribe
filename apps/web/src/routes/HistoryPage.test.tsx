// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import * as Y from "yjs";
import { DOC, docDoc } from "@syncscribe/shared";
import HistoryPage from "./HistoryPage";
import { newDocument } from "../crdt/actions";
import { getDoc } from "../crdt/registry";
import { useNetwork } from "../stores/network";
import { useSession } from "../stores/session";

// The REST client and the version download are faked; the endpoints are tested in apps/server.
const calls: { path: string; body?: unknown }[] = [];
vi.mock("../services/api", () => ({
  API_URL: "http://api.test",
  ApiError: class extends Error {},
  api: async (path: string, init: { body?: unknown } = {}) => {
    calls.push({ path, body: init.body });
    if (path.endsWith("/versions") && !init.body)
      return { versions: [{ id: "v1", docId: "x", name: "First draft", authors: ["Priya", "Ali"], createdAt: Date.UTC(2026, 10, 1, 9) }] };
    return {};
  },
}));
const old = new Y.Doc();
old.getText(DOC.content).insert(0, "# The old intro");
const state = Y.encodeStateAsUpdate(old);
vi.stubGlobal("fetch", async () => new Response(state.buffer.slice(state.byteOffset, state.byteOffset + state.byteLength) as ArrayBuffer));

it("lists versions, previews one and restores it as a new change (H1, H3, 4.9)", async () => {
  useSession.setState({ user: { id: "u1", email: "", name: "", color: "", personalWorkspaceId: "w1" }, token: "t" });
  useNetwork.setState({ serverReachable: true });
  const id = await newDocument("w1", null, "# Today's intro", "Report");
  render(
    <MemoryRouter initialEntries={[`/doc/${id}/history`]}>
      <Routes>
        <Route path="/doc/:docId/history" element={<HistoryPage />} />
        <Route path="/doc/:docId" element={<p>Back in the doc</p>} />
      </Routes>
    </MemoryRouter>,
  );
  fireEvent.click(await screen.findByText("First draft"));
  expect(screen.getByText("Priya, Ali")).toBeTruthy();
  await screen.findByRole("heading", { name: "The old intro" }); // read-only preview

  const restore = screen.getByText("Restore this version");
  await waitFor(() => expect((restore as HTMLButtonElement).disabled).toBe(false)); // the doc is loaded from the device
  fireEvent.click(restore);
  await screen.findByText("Back in the doc");
  const doc = await getDoc(docDoc(id));
  expect(doc.getText(DOC.content).toString()).toBe("# The old intro");
  // Today's text was kept as a named version before the restore
  expect(calls).toContainEqual({ path: `/docs/${id}/versions`, body: { name: expect.stringMatching(/^Before restoring /) } });
});

it("explains that history needs a connection when offline", async () => {
  const { cleanup } = await import("@testing-library/react");
  cleanup();
  useNetwork.setState({ serverReachable: false });
  render(
    <MemoryRouter initialEntries={["/doc/any/history"]}>
      <Routes>
        <Route path="/doc/:docId/history" element={<HistoryPage />} />
      </Routes>
    </MemoryRouter>,
  );
  await waitFor(() => expect(screen.getByText(/Version history needs a connection/)).toBeTruthy());
});
