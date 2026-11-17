// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { expect, it } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { wsDoc } from "@syncscribe/shared";
import TrashPage from "./TrashPage";
import { getDoc } from "../crdt/registry";
import { createDocItem, createFolder, readItem, trash } from "../crdt/tree";
import { useSession } from "../stores/session";

it("lists deleted items and restores a folder with its contents, all on the device (B10, 4.10)", async () => {
  useSession.setState({ activeWorkspaceId: "w1", user: { id: "u1", email: "", name: "", color: "", personalWorkspaceId: "w1" } });
  const ws = await getDoc(wsDoc("w1"));
  const folder = createFolder(ws, null, "Old notes", "u1");
  const doc = createDocItem(ws, folder, "u1");
  trash(ws, folder, "u1");

  render(
    <MemoryRouter>
      <TrashPage />
    </MemoryRouter>,
  );
  await screen.findByText("Old notes");
  expect(screen.queryByText("Untitled")).toBeNull(); // the doc inside isn't listed on its own
  fireEvent.click(screen.getByText("Restore"));
  await screen.findByText("Trash is empty.");
  await waitFor(() => expect(readItem(ws, doc)!.deletedAt).toBeNull());
});

it("deletes permanently after confirming; offline, the server request waits in the outbox (B10, FP-13)", async () => {
  const { cleanup } = await import("@testing-library/react");
  const { useNetwork } = await import("../stores/network");
  const { outboxItems } = await import("../services/outbox");
  cleanup();
  useNetwork.setState({ serverReachable: false });
  useSession.setState({ workspaces: [{ id: "w1", name: "Mine", kind: "personal", role: "owner" }] });
  const ws = await getDoc(wsDoc("w1"));
  const doc = createDocItem(ws, null, "u1");
  const local = await getDoc(`doc:${doc}`);
  local.getText("content").insert(0, "bye");
  trash(ws, doc, "u1");

  render(
    <MemoryRouter>
      <TrashPage />
    </MemoryRouter>,
  );
  fireEvent.click(await screen.findByText("Delete permanently"));
  await screen.findByText("Delete forever? This can't be undone.");
  fireEvent.click(screen.getByText("Delete"));
  // Deleting the local copy goes through IndexedDB, which can be slow when the whole suite runs
  await screen.findByText("Trash is empty.", {}, { timeout: 5000 });
  expect(readItem(ws, doc)).toBeUndefined();
  await waitFor(() => expect(outboxItems().map((i) => `${i.method} ${i.path}`)).toEqual([`DELETE /docs/${doc}`]), { timeout: 5000 });
  expect((await indexedDB.databases()).map((d) => d.name)).not.toContain(`u1:doc:${doc}`);
});
