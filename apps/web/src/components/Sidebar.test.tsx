// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { expect, it } from "vitest";
import { USER, userDoc, wsDoc } from "@syncscribe/shared";
import Sidebar from "./Sidebar";
import { getDoc } from "../crdt/registry";
import { newDocument } from "../crdt/actions";
import { addRecent } from "../crdt/prefs";
import { trash } from "../crdt/tree";
import { useSession } from "../stores/session";

useSession.setState({
  user: { id: "u1", email: "", name: "Priya", color: "", personalWorkspaceId: "w1" },
  workspaces: [{ id: "w1", name: "Priya's workspace", kind: "personal", role: "owner" }],
  activeWorkspaceId: "w1",
});

it("lists recent docs (not trashed ones) and saves the sort choice", async () => {
  const kept = await newDocument("w1", null, "", "Kept note");
  const gone = await newDocument("w1", null, "", "Gone note");
  const prefs = await getDoc(userDoc("u1"));
  addRecent(prefs, gone);
  addRecent(prefs, kept);
  trash(await getDoc(wsDoc("w1")), gone, "u1");

  render(<MemoryRouter><Sidebar /></MemoryRouter>);
  expect(await screen.findByText("Recent")).toBeTruthy();
  await waitFor(() => expect(screen.getAllByText("Kept note")).toHaveLength(2)); // in Recent and in the tree
  expect(screen.queryByText("Gone note")).toBeNull();

  fireEvent.change(screen.getByLabelText("Sort documents"), { target: { value: "name" } });
  expect(prefs.getMap(USER.settings).get("sort")).toBe("name");
});

it("Cmd/Ctrl+Alt+N creates a new document and opens it (C5)", async () => {
  const { cleanup } = await import("@testing-library/react");
  const { Route, Routes } = await import("react-router");
  cleanup();
  render(
    <MemoryRouter>
      <Sidebar />
      <Routes>
        <Route path="/" element={null} />
        <Route path="/doc/:docId" element={<p>New doc opened</p>} />
      </Routes>
    </MemoryRouter>,
  );
  await screen.findByText("Recent");
  fireEvent.keyDown(window, { key: "n", code: "KeyN", ctrlKey: true, altKey: true });
  await screen.findByText("New doc opened");
});

it("tags documents from the row menu and filters the tree by tag (B7)", async () => {
  const { cleanup } = await import("@testing-library/react");
  cleanup();
  await newDocument("w1", null, "", "Exam prep");
  await newDocument("w1", null, "", "Shopping list");
  render(<MemoryRouter><Sidebar /></MemoryRouter>);
  fireEvent.click(await screen.findByLabelText("Actions for Exam prep"));
  fireEvent.click(screen.getByText("Tags…"));
  const input = screen.getByLabelText("Tags, separated by commas");
  fireEvent.change(input, { target: { value: "exam, revision" } });
  fireEvent.keyDown(input, { key: "Enter" });
  fireEvent.blur(input);

  const filter = await screen.findByLabelText("Filter by tag");
  fireEvent.change(filter, { target: { value: "exam" } });
  await waitFor(() => expect(screen.queryByText("Shopping list")).toBeNull());
  expect(screen.getAllByText("Exam prep").length).toBeGreaterThan(0);
  fireEvent.change(filter, { target: { value: "" } }); // All tags
  await screen.findByText("Shopping list");
});
