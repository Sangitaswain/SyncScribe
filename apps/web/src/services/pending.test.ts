import { expect, it } from "vitest";
import * as Y from "yjs";
import { closeAll, getDoc } from "../crdt/registry";
import { remoteOrigins } from "../sync/origins";
import { useSession } from "../stores/session";
import { useNetwork } from "../stores/network";
import { useDocStatus } from "../stores/docStatus";
import { clearPending, loadPending, pendingNames } from "./pending";

useSession.setState({ user: { id: "u9", email: "", name: "", color: "", personalWorkspaceId: "w" } });
const tick = () => new Promise((r) => setTimeout(r, 50));

it("marks local edits as pending and keeps them across reloads", async () => {
  const doc = await getDoc("doc:p1");
  expect(pendingNames()).toEqual([]); // loading from disk is not an edit

  doc.getText("content").insert(0, "offline edit");
  await tick();
  expect(pendingNames()).toEqual(["doc:p1"]);
  expect(useNetwork.getState().pendingCount).toBe(1);
  expect(useDocStatus.getState()["doc:p1"].pending).toBe(true);

  closeAll();
  await loadPending(); // simulate a page reload
  expect(pendingNames()).toEqual(["doc:p1"]);

  await clearPending("doc:p1");
  expect(useNetwork.getState().pendingCount).toBe(0);
});

it("ignores changes that came from the server", async () => {
  const doc = await getDoc("doc:p2");
  const provider = {};
  remoteOrigins.add(provider);
  const other = new Y.Doc();
  other.getText("content").insert(0, "from a teammate");
  Y.applyUpdate(doc, Y.encodeStateAsUpdate(other), provider);
  await tick();
  expect(pendingNames()).not.toContain("doc:p2");
  closeAll();
});
