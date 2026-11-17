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
