// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import SharedPage from "./SharedPage";
import AcceptLinkPage from "./AcceptLinkPage";
import MembersPage from "./MembersPage";
import WorkspaceSwitcher from "../components/WorkspaceSwitcher";
import { useSession } from "../stores/session";
import { useNetwork } from "../stores/network";
import { setDocStatus } from "../stores/docStatus";

// REST is faked here; the endpoints themselves are tested in apps/server.
const answers: Record<string, unknown> = {};
const calls: string[] = [];
vi.mock("../services/api", () => ({
  ApiError: class extends Error {},
  api: async (path: string, init: { method?: string } = {}) => {
    calls.push(`${init.method ?? "GET"} ${path}`);
    const answer = answers[path];
    if (answer instanceof Error) throw answer;
    return answer;
  },
}));

const user = { id: "u1", email: "me@example.com", name: "Me", color: "#2563eb", personalWorkspaceId: "w1" };
beforeEach(() => {
  cleanup();
  calls.length = 0;
  useSession.setState({
    status: "signedIn",
    user,
    activeWorkspaceId: "w1",
    workspaces: [
      { id: "w1", name: "Me's workspace", kind: "personal", role: "owner" },
      { id: "t1", name: "Lab group", kind: "team", role: "owner" },
    ],
  });
  useNetwork.setState({ serverReachable: true });
});

const at = (path: string, route: string, element: React.ReactNode) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={route} element={element} />
        <Route path="/doc/:docId" element={<p>Opened doc</p>} />
        <Route path="/" element={<p>Home</p>} />
      </Routes>
    </MemoryRouter>,
  );

it("Shared with me lists shared items and still shows them offline, without revoked ones (G1)", async () => {
  answers["/shared-with-me"] = {
    items: [
      { id: "d1", type: "doc", title: "Group report", role: "editor", ownerName: "Priya" },
      { id: "d2", type: "doc", title: "Old plan", role: "viewer", ownerName: "Ali" },
    ],
  };
  at("/shared", "/shared", <SharedPage />);
  await screen.findByText("Group report");
  expect(screen.getByText("Priya · Can edit")).toBeTruthy();

  // Offline later: the cached list shows; a doc whose access was removed is hidden
  cleanup();
  useNetwork.setState({ serverReachable: false });
  setDocStatus("doc:d2", { revoked: true });
  at("/shared", "/shared", <SharedPage />);
  await screen.findByText("Group report");
  expect(screen.queryByText("Old plan")).toBeNull();
  expect(screen.getByText(/You're offline/)).toBeTruthy();
});

it("a share link opens the doc, an inactive one says so, signed-out visitors are asked to sign in (G3, EC23)", async () => {
  answers["/share-links/good/accept"] = { resourceId: "d9", role: "viewer" };
  at("/s/good", "/s/:token", <AcceptLinkPage />);
  await screen.findByText("Opened doc");

  cleanup();
  answers["/share-links/old/accept"] = new Error("This link is no longer active");
  at("/s/old", "/s/:token", <AcceptLinkPage />);
  await screen.findByText("This link is no longer active");

  cleanup();
  useSession.setState({ status: "signedOut", user: null });
  at("/s/good", "/s/:token", <AcceptLinkPage />);
  expect((await screen.findByText("Sign in")).getAttribute("href")).toBe("/login?next=%2Fs%2Fgood");
});

it("the owner of a team workspace manages its members (B2)", async () => {
  answers["/workspaces/t1/members"] = {
    members: [
      { userId: "u1", name: "Me", email: "me@example.com", color: "#2563eb", role: "owner" },
      { userId: "u2", name: "Mia", email: "mia@example.com", color: "#16a34a", role: "editor" },
    ],
  };
  at("/workspaces/t1/members", "/workspaces/:id/members", <MembersPage />);
  await screen.findByText("Mia");
  expect(screen.getByLabelText("Email address")).toBeTruthy();
  fireEvent.click(screen.getByText("Remove"));
  expect(calls).toContain("DELETE /workspaces/t1/members/u2");
});

it("the workspace switcher changes the active workspace", async () => {
  render(
    <MemoryRouter>
      <WorkspaceSwitcher />
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByTitle("Workspace"));
  fireEvent.click(screen.getByText("Lab group"));
  expect(useSession.getState().activeWorkspaceId).toBe("t1");
});
