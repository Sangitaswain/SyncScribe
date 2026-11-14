// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { expect, it } from "vitest";
import { wsDoc } from "@syncscribe/shared";
import TreeView from "./TreeView";
import { getDoc } from "../crdt/registry";
import { createFolder } from "../crdt/tree";
import { newDocument } from "../crdt/actions";
import { useSession } from "../stores/session";

useSession.setState({ user: { id: "u1", email: "", name: "", color: "", personalWorkspaceId: "w1" } });

it("shows folders and document titles from the workspace", async () => {
  const ws = await getDoc(wsDoc("w1"));
  const folder = createFolder(ws, null, "Reports", "u1");
  await newDocument("w1", folder, "", "Group report");
  await newDocument("w1", null, "", "");

  render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route path="/" element={<TreeView workspaceId="w1" />} />
      </Routes>
    </MemoryRouter>,
  );
  expect(await screen.findByText("Reports")).toBeTruthy();
  await waitFor(() => expect(screen.getByText("Group report")).toBeTruthy());
  expect(await screen.findByText("Untitled")).toBeTruthy();
});
