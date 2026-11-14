// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, expect, it } from "vitest";
import { useState } from "react";
import { wsDoc } from "@syncscribe/shared";
import TreeView from "./TreeView";
import { getDoc } from "../crdt/registry";
import { createFolder, readItem } from "../crdt/tree";
import { newDocument } from "../crdt/actions";
import { useSession } from "../stores/session";

useSession.setState({ user: { id: "u1", email: "", name: "", color: "", personalWorkspaceId: "w1" } });
afterEach(cleanup);

function Harness({ ws }: { ws: string }) {
  const [renaming, setRenaming] = useState<string | null>(null);
  return (
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route path="*" element={<TreeView workspaceId={ws} renaming={renaming} setRenaming={setRenaming} />} />
      </Routes>
    </MemoryRouter>
  );
}

it("shows folders and document titles from the workspace", async () => {
  const ws = await getDoc(wsDoc("w1"));
  const folder = createFolder(ws, null, "Reports", "u1");
  await newDocument("w1", folder, "", "Group report");
  await newDocument("w1", null, "", "");
  render(<Harness ws="w1" />);
  expect(await screen.findByText("Reports")).toBeTruthy();
  await waitFor(() => expect(screen.getByText("Group report")).toBeTruthy());
  expect(await screen.findByText("Untitled")).toBeTruthy();
});

it("renames, moves and deletes through the row menu", async () => {
  const ws = await getDoc(wsDoc("w2"));
  const folder = createFolder(ws, null, "Inbox", "u1");
  const id = await newDocument("w2", null, "", "Draft");
  render(<Harness ws="w2" />);
  await screen.findByText("Draft");

  fireEvent.click(screen.getByLabelText("Actions for Draft"));
  fireEvent.click(screen.getByText("Rename"));
  const input = screen.getByLabelText("New name") as HTMLInputElement;
  fireEvent.change(input, { target: { value: "Final report" } });
  fireEvent.keyDown(input, { key: "Enter" });
  fireEvent.blur(input);
  await screen.findByText("Final report");

  fireEvent.click(screen.getByLabelText("Actions for Final report"));
  fireEvent.click(screen.getByText("Move to…"));
  fireEvent.click(screen.getAllByText("Inbox").at(-1)!);
  await waitFor(() => expect(readItem(ws, id)?.parentId).toBe(folder));

  fireEvent.click(screen.getByLabelText("Actions for Final report"));
  fireEvent.click(screen.getByText("Delete"));
  await waitFor(() => expect(screen.queryByText("Final report")).toBeNull());
  expect(readItem(ws, id)?.deletedAt).toBeTypeOf("number");
  expect(screen.getByText("Inbox")).toBeTruthy(); // folder still open: clicks did not toggle it
});
