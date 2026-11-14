import { afterAll, beforeAll, expect, it } from "vitest";
import * as Y from "yjs";
import { hocuspocus } from "./hocuspocus";
import { fetchState } from "./persistence";
import { connect, startServer, until } from "../test/collabServer";

let srv: Awaited<ReturnType<typeof startServer>>;
beforeAll(async () => (srv = await startServer()));
afterAll(() => srv.close());

it("relays edits between clients and persists them to SQLite", async () => {
  const a = await connect(srv.port, "doc:persist");
  const b = await connect(srv.port, "doc:persist");
  a.doc.getText("content").insert(0, "hello from A");
  await until(() => b.doc.getText("content").toString() === "hello from A"); // live relay

  hocuspocus.flushPendingStores();
  await until(() => fetchState("doc:persist") !== null);
  a.provider.destroy();
  b.provider.destroy();

  // Fresh client after the document left memory: state comes back from the database
  await until(() => !hocuspocus.documents.has("doc:persist"));
  const stored = new Y.Doc();
  Y.applyUpdate(stored, fetchState("doc:persist")!);
  expect(stored.getText("content").toString()).toBe("hello from A");
  const c = await connect(srv.port, "doc:persist");
  expect(c.doc.getText("content").toString()).toBe("hello from A");
  c.provider.destroy();
});
