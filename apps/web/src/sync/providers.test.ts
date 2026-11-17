import { afterAll, beforeAll, expect, test, vi } from "vitest";
import * as Y from "yjs";
import { DOC, WS, docDoc, wsDoc, type AuthResponse } from "@syncscribe/shared";

// Runs the real sync server: one "device" uses the Provider Manager, the other a plain provider.
vi.stubEnv("DB_PATH", ":memory:");
Object.defineProperty(navigator, "onLine", { value: true, configurable: true });

let server: Awaited<ReturnType<typeof import("../../../server/src/test/collabServer").startServer>>;
let helpers: typeof import("../../../server/src/test/collabServer");
let auth: AuthResponse;

beforeAll(async () => {
  helpers = await import("../../../server/src/test/collabServer");
  server = await helpers.startServer();
  vi.stubEnv("VITE_API_URL", `http://localhost:${server.port}`);
  const res = await fetch(`http://localhost:${server.port}/api/auth/signup`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "Ada", email: "ada@example.com", password: "password123" }),
  });
  auth = await res.json();
  const { saveSession } = await import("../services/session");
  await saveSession(auth);
});

afterAll(async () => {
  const { stopSync } = await import("./providers");
  await stopSync();
  await server.close();
});

test("edits sync both ways between the Provider Manager and another device", async () => {
  const { startSync, syncWhileOpen, providerFor, whenSynced } = await import("./providers");
  const ws = wsDoc(auth.user.personalWorkspaceId);
  startSync();
  const tree = await providerFor(ws)!;
  await whenSynced(tree);

  // The seeded Welcome doc came down with the workspace tree; open it on both devices
  const docId = [...(tree.document.getMap(WS.items).keys() as Iterable<string>)].find(
    (id) => (tree.document.getMap(WS.items).get(id) as Y.Map<unknown>).get("type") === "doc",
  )!;
  const stop = syncWhileOpen(docDoc(docId));
  await helpers.until(() => !!providerFor(docDoc(docId)));
  const mine = await providerFor(docDoc(docId))!;
  await whenSynced(mine);
  const other = await helpers.connect(server.port, docDoc(docId), auth.token);

  const { pendingNames } = await import("../services/pending");
  mine.document.getText(DOC.content).insert(0, "from manager ");
  expect(pendingNames()).toContain(docDoc(docId));
  await helpers.until(() => other.doc.getText(DOC.content).toString().startsWith("from manager "));
  await helpers.until(() => !pendingNames().includes(docDoc(docId))); // server confirmed it

  other.doc.getText(DOC.content).insert(0, "from other ");
  await helpers.until(() => mine.document.getText(DOC.content).toString().startsWith("from other "));

  other.provider.destroy();
  stop();
});

test("on reconnect, closed docs edited offline upload and docs changed elsewhere download", async () => {
  const { providerFor, isAttached } = await import("./providers");
  const { syncClosedDocs } = await import("./background");
  const { getDoc, releaseDoc } = await import("../crdt/registry");
  const { pendingNames } = await import("../services/pending");
  const tree = await providerFor(wsDoc(auth.user.personalWorkspaceId))!;
  const docId = [...(tree.document.getMap(WS.items).keys() as Iterable<string>)][0];
  const name = docDoc(docId);
  expect(isAttached(name)).toBe(false); // closed

  // Edited "offline" while closed: saved locally and marked pending, no provider attached
  const local = await getDoc(name);
  local.getText(DOC.content).insert(0, "closed edit ");
  releaseDoc(name);
  expect(pendingNames()).toContain(name);

  // Meanwhile another device changes it on the server
  const other = await helpers.connect(server.port, name, auth.token);
  other.doc.getText(DOC.content).insert(0, "remote edit ");

  await syncClosedDocs();
  await helpers.until(() => other.doc.getText(DOC.content).toString().includes("closed edit "));
  expect(pendingNames()).not.toContain(name);
  expect(isAttached(name)).toBe(false); // disconnected again afterwards
  const reopened = await getDoc(name); // the download was saved on the device
  expect(reopened.getText(DOC.content).toString()).toContain("remote edit ");
  releaseDoc(name);
  other.provider.destroy();
});

test("Sync now reconnects; repeated refusals show a sync error that Retry clears (E7, EC39)", async () => {
  const { providerFor, reconnect, syncWhileOpen, whenSynced } = await import("./providers");
  const { useNetwork } = await import("../stores/network");
  const { useSession } = await import("../stores/session");
  const tree = await providerFor(wsDoc(auth.user.personalWorkspaceId))!;
  const socket = tree.configuration.websocketProvider;
  const reconnected = () => new Promise<void>((resolve) => socket.on("connect", resolve));

  // A forced reconnect of a live socket must come back up
  let back = reconnected();
  reconnect(true);
  await back;
  await whenSynced(tree);

  // With a doc open, the server refuses all three (user, workspace, doc) → Sync error
  const docId = [...(tree.document.getMap(WS.items).keys() as Iterable<string>)][0];
  const stop = syncWhileOpen(docDoc(docId));
  await helpers.until(() => !!providerFor(docDoc(docId)));
  await whenSynced(await providerFor(docDoc(docId))!);
  useSession.setState({ token: "not-a-valid-token" });
  reconnect(true);
  await helpers.until(() => !!useNetwork.getState().errorReason);

  // Retry with a working session clears it
  useSession.setState({ token: auth.token });
  back = reconnected();
  reconnect(true);
  await back;
  await helpers.until(() => tree.isAuthenticated && useNetwork.getState().errorReason === null);
  stop();
});
