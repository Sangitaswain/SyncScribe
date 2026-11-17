// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { get, keys, set } from "idb-keyval";
import SignOutDialog from "./SignOutDialog";
import { getDoc, releaseDoc } from "../crdt/registry";
import { useSession } from "../stores/session";
import { useUi } from "../stores/ui";
import { saveSession } from "../services/session";

// No sync server here: signing out only closes the local docs
vi.mock("../sync/providers", async () => ({ stopSync: async () => (await import("../crdt/registry")).closeAll() }));
vi.mock("../sync/network", () => ({ syncNow: () => {} }));

const user = (id: string) => ({ id, email: `${id}@example.com`, name: id, color: "#000000", personalWorkspaceId: `w-${id}` });
const signIn = (id: string) => saveSession({ user: user(id), token: "t", workspaces: [] });
const dbNames = async () => (await indexedDB.databases()).map((d) => d.name);
const tick = () => new Promise((r) => setTimeout(r, 50));

it("warns about unsynced changes; keeping data leaves it on the device (A2, EC20)", async () => {
  await signIn("u5");
  const doc = await getDoc("doc:report");
  doc.getMap("meta").set("title", "Group report");
  doc.getText("content").insert(0, "not synced yet");
  await tick();
  releaseDoc("doc:report");

  useUi.setState({ modal: "signout" });
  render(<SignOutDialog />);
  await screen.findByText("These changes haven't synced yet. They are safe on this device unless you clear it.");
  await screen.findByText("Group report");
  fireEvent.click(screen.getByText("Sign out and keep data on this device"));
  await waitFor(() => expect(useSession.getState().status).toBe("signedOut"));
  expect(await dbNames()).toContain("u5:doc:report");
});

it("clearing the device deletes only this user's local data (EC21)", async () => {
  cleanup();
  await set("u6:outbox", ["someone else's"]);
  await signIn("u5");
  await getDoc("doc:report");

  useUi.setState({ modal: "signout" });
  render(<SignOutDialog />);
  fireEvent.click(await screen.findByText(/Sign out and clear this device/));
  await waitFor(() => expect(useSession.getState().status).toBe("signedOut"));
  expect((await dbNames()).filter((n) => n?.startsWith("u5:"))).toEqual([]);
  expect((await keys()).filter((k) => String(k).startsWith("u5:"))).toEqual([]);
  expect(await get("u6:outbox")).toEqual(["someone else's"]);
  expect(await get("session")).toBeUndefined();
});
