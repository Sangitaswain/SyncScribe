// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { Role, Share } from "@syncscribe/shared";
import ShareDialog from "./ShareDialog";
import { useNetwork } from "../stores/network";
import { useUi } from "../stores/ui";

// The REST client is faked; the server side of sharing is covered in apps/server/src/routes/shares.test.ts.
const calls: { path: string; method?: string; body?: unknown }[] = [];
let role: Role = "owner";
let shares: Share[] = [];
vi.mock("../services/api", () => ({
  ApiError: class extends Error {},
  api: async (path: string, init: { method?: string; body?: unknown } = {}) => {
    calls.push({ path, ...init });
    if (path.startsWith("/shares?")) return { role, shares };
    if (path.startsWith("/share-links?")) return { links: [{ id: "l1", resourceId: "d1", role: "viewer", revoked: false }] };
    if (path === "/share-links") return { id: "l2", resourceId: "d1", role: "viewer", url: "http://localhost:5173/s/tok", revoked: false };
    if (path === "/shares") {
      const body = init.body as { email: string; role: Share["role"] };
      shares = [...shares, { id: "s1", resourceId: "d1", userId: "u2", email: body.email, name: "Bea", role: body.role }];
      return shares[0];
    }
    return {};
  },
}));

beforeEach(() => {
  cleanup();
  calls.length = 0;
  shares = [];
  useUi.setState({ modal: "share:d1" });
});

it("an owner invites by email and role, manages access and makes links (G1–G4)", async () => {
  role = "owner";
  useNetwork.setState({ serverReachable: true });
  render(<ShareDialog />);
  fireEvent.change(await screen.findByLabelText("Email address"), { target: { value: "bea@example.com" } });
  fireEvent.change(screen.getAllByLabelText("Role")[0], { target: { value: "viewer" } });
  fireEvent.click(screen.getByText("Invite"));
  await screen.findByText("Invited bea@example.com");
  expect(calls).toContainEqual({ path: "/shares", method: "POST", body: { resourceId: "d1", email: "bea@example.com", role: "viewer" } });

  // Bea now shows with owner controls
  await screen.findByText("Bea");
  fireEvent.click(screen.getByText("Remove"));
  expect(calls).toContainEqual({ path: "/shares/s1", method: "DELETE" });
  fireEvent.click(screen.getByText("Create"));
  expect(((await screen.findByLabelText("Share link")) as HTMLInputElement).value).toBe("http://localhost:5173/s/tok");
  fireEvent.click(screen.getByText("Revoke"));
  expect(calls).toContainEqual({ path: "/share-links/l1", method: "DELETE" });
});

it("an editor can invite but not change access or make links", async () => {
  role = "editor";
  shares = [{ id: "s9", resourceId: "d1", userId: "u3", email: "cy@example.com", name: "Cy", role: "commenter" }];
  useNetwork.setState({ serverReachable: true });
  render(<ShareDialog />);
  await screen.findByText("Cy");
  expect(screen.getByLabelText("Email address")).toBeTruthy();
  expect(screen.getByText("Commenter", { selector: "span" })).toBeTruthy(); // shown, not editable
  expect(screen.queryByText("Remove")).toBeNull();
  expect(screen.queryByText("Share link")).toBeNull();
});

it("offline, an invite is queued with a message (4.8)", async () => {
  useNetwork.setState({ serverReachable: false });
  render(<ShareDialog />);
  await screen.findByText(/You're offline/);
  fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "dee@example.com" } });
  fireEvent.click(screen.getByText("Invite"));
  await screen.findByText("Invitation will be sent when you're back online");
  expect(calls).toEqual([]);
});
