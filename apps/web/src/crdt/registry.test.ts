import { expect, it } from "vitest";
import { closeAll, getDoc, peekDoc, releaseDoc } from "./registry";
import { useSession } from "../stores/session";

useSession.setState({ user: { id: "u1", email: "", name: "", color: "", personalWorkspaceId: "w1" } });

it("persists a doc on the device and restores it after closing", async () => {
  const doc = await getDoc("doc:a");
  doc.getText("content").insert(0, "hello offline");
  await new Promise((r) => setTimeout(r, 50)); // let IndexedDB write
  releaseDoc("doc:a");
  expect(peekDoc("doc:a")).toBeUndefined();

  const again = await getDoc("doc:a");
  expect(again).not.toBe(doc);
  expect(again.getText("content").toString()).toBe("hello offline");
  releaseDoc("doc:a");
});

it("shares one instance and keeps workspace docs open", async () => {
  const [a, b] = await Promise.all([getDoc("doc:b"), getDoc("doc:b")]);
  expect(a).toBe(b);
  releaseDoc("doc:b");
  expect(peekDoc("doc:b")).toBe(a); // still one reference
  releaseDoc("doc:b");
  expect(peekDoc("doc:b")).toBeUndefined();

  await getDoc("ws:w1");
  releaseDoc("ws:w1");
  expect(peekDoc("ws:w1")).toBeDefined();
  closeAll();
});

it("keeps different users' data apart", async () => {
  (await getDoc("doc:c")).getText("content").insert(0, "u1 secret");
  await new Promise((r) => setTimeout(r, 50));
  closeAll();
  useSession.setState({ user: { id: "u2", email: "", name: "", color: "", personalWorkspaceId: "w2" } });
  expect((await getDoc("doc:c")).getText("content").toString()).toBe("");
  closeAll();
});

it("records when a document was last edited, at most once a minute", async () => {
  const doc = await getDoc("doc:edited");
  doc.getText("content").insert(0, "a");
  await new Promise((r) => setTimeout(r, 10));
  const first = doc.getMap("meta").get("editedAt") as number;
  expect(first).toBeGreaterThan(Date.now() - 5000);
  doc.getText("content").insert(0, "b");
  await new Promise((r) => setTimeout(r, 10));
  expect(doc.getMap("meta").get("editedAt")).toBe(first); // throttled
  closeAll();
});

it("fixes a folder loop that arrives from the server and says so (EC12)", async () => {
  const Y = await import("yjs");
  const { createFolder, move, readItem } = await import("./tree");
  const { remoteOrigins } = await import("../sync/origins");
  const { useUi } = await import("../stores/ui");
  const local = await getDoc("ws:loop");
  const x = createFolder(local, null, "Notes", "u1");
  const y = createFolder(local, null, "Drafts", "u1");
  const remote = new Y.Doc();
  Y.applyUpdate(remote, Y.encodeStateAsUpdate(local));
  move(local, x, y);
  move(remote, y, x); // someone else, at the same time

  const server = {};
  remoteOrigins.add(server);
  Y.applyUpdate(local, Y.encodeStateAsUpdate(remote), server);
  await new Promise((r) => setTimeout(r, 10));
  const victim = [x, y].sort()[0];
  expect(readItem(local, victim)!.parentId).toBeNull();
  expect(useUi.getState().toasts.map((t) => t.message)).toContain(
    `Folder moves conflicted; "${victim === x ? "Notes" : "Drafts"}" was moved to the top level`,
  );
  closeAll();
});
