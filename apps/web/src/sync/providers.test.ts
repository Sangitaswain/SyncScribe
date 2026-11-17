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
  const { attach, detach, providerFor, reconnect, whenSynced } = await import("./providers");
  const { useNetwork } = await import("../stores/network");
  const tree = await providerFor(wsDoc(auth.user.personalWorkspaceId))!;
  const socket = tree.configuration.websocketProvider;
  const reconnected = () => new Promise<void>((resolve) => socket.on("connect", resolve));

  // A forced reconnect of a live socket must come back up
  const back = reconnected();
  reconnect(true);
  await back;
  await whenSynced(tree);

  // A doc the server has never heard of is retried, then refused a third time → Sync error
  await attach("doc:nope");
  await helpers.until(() => !!useNetwork.getState().errorReason, 8000);
  await detach("doc:nope");
}, 15_000);

test("an expired session asks to sign in again, then sync resumes (FP-10.2, EC19)", async () => {
  const { providerFor, reconnect } = await import("./providers");
  const { useSession } = await import("../stores/session");
  const { signToken } = await import("../../../server/src/auth/jwt");
  const tree = await providerFor(wsDoc(auth.user.personalWorkspaceId))!;

  useSession.setState({ token: await signToken(auth.user, "1s") });
  await new Promise((r) => setTimeout(r, 1100));
  reconnect(true);
  await helpers.until(() => useSession.getState().status === "needsReauth");

  useSession.setState({ token: auth.token, status: "signedIn" }); // signed in again (main.tsx then reconnects)
  reconnect(true);
  await helpers.until(() => tree.isAuthenticated);
});

test("a doc refused as unknown is retried once its workspace tree reaches the server (FP-10.2)", async () => {
  const { attach, detach, providerFor } = await import("./providers");
  const { createDocItem } = await import("../crdt/tree");
  const tree = await providerFor(wsDoc(auth.user.personalWorkspaceId))!;

  // The doc is listed in a tree change the server has not received yet
  const scratch = new Y.Doc();
  const id = createDocItem(scratch, null, auth.user.id);
  const doc = await attach(docDoc(id));
  await new Promise((r) => doc.on("authenticationFailed", r));

  Y.applyUpdate(tree.document, Y.encodeStateAsUpdate(scratch));
  await helpers.until(() => doc.isAuthenticated, 5000);
  await detach(docDoc(id));
});

test("a device that never synced downloads every document and marks it available offline (A6, D6, DF13)", async () => {
  const { syncClosedDocs } = await import("./background");
  const { createDocItem } = await import("../crdt/tree");
  const { getDoc, releaseDoc } = await import("../crdt/registry");
  const { useDocStatus } = await import("../stores/docStatus");
  const { del, get } = await import("idb-keyval");

  // Another device adds a document with text
  const ws = wsDoc(auth.user.personalWorkspaceId);
  const otherTree = await helpers.connect(server.port, ws, auth.token);
  await helpers.until(() => otherTree.provider.isSynced);
  const id = createDocItem(otherTree.doc, null, auth.user.id);
  const otherDoc = await helpers.connect(server.port, docDoc(id), auth.token);
  otherDoc.doc.getText(DOC.content).insert(0, "written elsewhere");
  await helpers.until(() => otherDoc.provider.isSynced && otherDoc.provider.unsyncedChanges === 0);

  // The server lists a doc once it has stored it (debounced up to 10 s)
  const { api } = await import("../services/api");
  for (let i = 0; i < 60; i++) {
    if ((await api<{ names: string[] }>("/sync/all")).names.includes(docDoc(id))) break;
    await new Promise((r) => setTimeout(r, 250));
  }

  // This device has never synced: everything it can access is downloaded
  await del(`${auth.user.id}:lastSyncedAt`);
  await syncClosedDocs();
  expect(useDocStatus.getState()[docDoc(id)]?.offlineAvailable).toBe(true);
  expect(await get(`${auth.user.id}:offlineSet`)).toContain(docDoc(id));
  const local = await getDoc(docDoc(id)); // opens from the device, no network needed
  expect(local.getText(DOC.content).toString()).toBe("written elsewhere");
  releaseDoc(docDoc(id));
  otherTree.provider.destroy();
  otherDoc.provider.destroy();
}, 20_000);

test("collaborators on an open doc see each other's name, colour and cursor (F1, F3)", async () => {
  const { providerFor, syncWhileOpen, whenSynced } = await import("./providers");
  const { awarenessOf } = await import("../crdt/registry");
  const tree = await providerFor(wsDoc(auth.user.personalWorkspaceId))!;
  const name = docDoc([...(tree.document.getMap(WS.items).keys() as Iterable<string>)][0]);
  const stop = syncWhileOpen(name);
  await helpers.until(() => !!providerFor(name));
  await whenSynced(await providerFor(name)!);

  const mine = awarenessOf(name)!;
  mine.setLocalStateField("cursor", { anchor: 3, head: 7 });
  const other = await helpers.connect(server.port, name, auth.token);
  other.provider.awareness!.setLocalStateField("user", { id: "x", name: "Bo", color: "#2563eb" });

  const states = (a: typeof mine) => [...a.getStates().values()] as { user?: { name: string; color: string }; cursor?: unknown }[];
  await helpers.until(() =>
    states(other.provider.awareness!).some((s) => s.user?.name === auth.user.name && s.user.color === auth.user.color && !!s.cursor),
  );
  await helpers.until(() => states(mine).some((s) => s.user?.name === "Bo"));
  other.provider.destroy();
  stop();
});
