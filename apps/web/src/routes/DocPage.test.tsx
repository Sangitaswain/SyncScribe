// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { expect, it, vi } from "vitest";
import * as Y from "yjs";
import { USER, docDoc, userDoc } from "@syncscribe/shared";
import DocPage from "./DocPage";
import StatusBar from "../components/StatusBar";
import TopBar from "../components/TopBar";
import { newDocument } from "../crdt/actions";
import { getDoc } from "../crdt/registry";
import { useSession } from "../stores/session";

// No sync server in unit tests
vi.mock("../sync/providers", () => ({ syncWhileOpen: () => () => {} }));
vi.mock("../sync/network", () => ({ syncNow: () => {} }));

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

it("shows who is in the document, and my avatar as offline when I am (F2, 4.6)", async () => {
  const { Awareness, applyAwarenessUpdate, encodeAwarenessUpdate, removeAwarenessStates } = await import("y-protocols/awareness");
  const { awarenessOf } = await import("../crdt/registry");
  const { useNetwork } = await import("../stores/network");
  const { act, cleanup } = await import("@testing-library/react");
  cleanup(); // unmount the previous test's page
  useSession.setState({ user: { id: "u1", email: "", name: "Ada", color: "#16a34a", personalWorkspaceId: "w1" } });
  const id = await newDocument("w1", null, "", "Shared");
  render(
    <MemoryRouter initialEntries={[`/doc/${id}`]}>
      <TopBar />
      <Routes>
        <Route path="/doc/:docId" element={<DocPage />} />
      </Routes>
    </MemoryRouter>,
  );
  await screen.findByTitle("Ada");

  // A collaborator opens the doc, then closes it
  const bo = new Awareness(new Y.Doc());
  bo.setLocalStateField("user", { id: "u2", name: "Bo", color: "#2563eb" });
  const mine = awarenessOf(docDoc(id))!;
  act(() => applyAwarenessUpdate(mine, encodeAwarenessUpdate(bo, [bo.clientID]), "remote"));
  await screen.findByTitle("Bo");
  act(() => removeAwarenessStates(mine, [bo.clientID], "remote"));
  await waitFor(() => expect(screen.queryByTitle("Bo")).toBeNull());

  act(() => useNetwork.setState({ syncState: "offline" }));
  await screen.findByTitle("Ada (offline)");
});

it("viewers get a read-only editor; removed access offers an export of the local copy (G5, EC16)", async () => {
  const { cleanup } = await import("@testing-library/react");
  const { setDocStatus } = await import("../stores/docStatus");
  cleanup();
  const id = await newDocument("w1", null, "kept on this device", "Notes");
  setDocStatus(docDoc(id), { role: "viewer" });
  render(
    <MemoryRouter initialEntries={[`/doc/${id}`]}>
      <Routes>
        <Route path="/doc/:docId" element={<DocPage />} />
      </Routes>
    </MemoryRouter>,
  );
  await screen.findByText("You can view this document but not edit it.");
  await waitFor(() => expect(document.querySelector(".cm-content")?.getAttribute("contenteditable")).toBe("false"));
  expect((screen.getByLabelText("Document title") as HTMLInputElement).readOnly).toBe(true);

  setDocStatus(docDoc(id), { revoked: true });
  await screen.findByText(/Your access to this document was removed/);
  expect(screen.getByText("Export my local copy")).toBeTruthy();
  expect(screen.getByText("Remove from this device")).toBeTruthy();
});

it("shows who deleted the open doc and restores it (EC9)", async () => {
  const { cleanup } = await import("@testing-library/react");
  const { wsDoc } = await import("@syncscribe/shared");
  const { trash, readItem } = await import("../crdt/tree");
  cleanup();
  useSession.setState({ activeWorkspaceId: "w1" });
  const id = await newDocument("w1", null, "still here", "Plan");
  render(
    <MemoryRouter initialEntries={[`/doc/${id}`]}>
      <Routes>
        <Route path="/doc/:docId" element={<DocPage />} />
      </Routes>
    </MemoryRouter>,
  );
  await screen.findByLabelText("Document title");
  const ws = await getDoc(wsDoc("w1"));
  trash(ws, id, "u2", "Owen");
  await screen.findByText("This document was deleted by Owen. Your changes are still saved.");
  fireEvent.click(screen.getByText("Restore"));
  await waitFor(() => expect(screen.queryByText(/This document was deleted/)).toBeNull());
  expect(readItem(ws, id)!.deletedAt).toBeNull();
});
