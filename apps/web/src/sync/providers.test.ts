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
