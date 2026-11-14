import { afterEach, expect, it, vi } from "vitest";
import * as Y from "yjs";
import { DOC } from "@syncscribe/shared";
import { getDoc } from "../crdt/registry";
import { useSession } from "../stores/session";
import { bootstrap } from "./bootstrap";
import { pendingNames } from "./pending";

afterEach(() => vi.restoreAllMocks());

it("saves server documents on the device without marking them pending", async () => {
  useSession.setState({ status: "signedIn", token: "t", user: { id: "u5", email: "", name: "", color: "", personalWorkspaceId: "w5" } });
  Object.defineProperty(navigator, "onLine", { value: true, configurable: true });
  const welcome = new Y.Doc();
  welcome.getMap(DOC.meta).set("title", "Welcome to SyncScribe");
  const b64 = btoa(String.fromCharCode(...Y.encodeStateAsUpdate(welcome)));
  vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ docs: { "doc:wel": b64 } })));

  await bootstrap();
  expect((await getDoc("doc:wel")).getMap(DOC.meta).get("title")).toBe("Welcome to SyncScribe");
  expect(pendingNames()).not.toContain("doc:wel");
});
