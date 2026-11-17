import { afterAll, beforeAll, expect, it } from "vitest";
import * as Y from "yjs";
import request from "supertest";
import { app } from "../app";
import { db } from "../db/db";
import { hocuspocus } from "./hocuspocus";
import { maybeSnapshot, noteAuthor } from "./versions";
import { connect, startServer, until } from "../test/collabServer";

let srv: Awaited<ReturnType<typeof startServer>>;
beforeAll(async () => {
  srv = await startServer();
});
afterAll(() => srv.close());

const versions = (docId: string) =>
  db.prepare("SELECT authors, name FROM versions WHERE doc_id = ? ORDER BY created_at").all(docId) as { authors: string; name: string | null }[];

it("editing creates versions with their authors: every 10 minutes and when a session ends (H1)", async () => {
  const me = (await request(app).post("/api/auth/signup").send({ name: "Vee", email: "vee@example.com", password: "secret123" })).body;
  const { names } = (await request(app).get("/api/sync/all").set("Authorization", `Bearer ${me.token}`)).body;
  const name = names.find((n: string) => n.startsWith("doc:"));
  const docId = name.slice(4);

  const c = await connect(srv.port, name, me.token);
  c.doc.getText("content").insert(0, "first draft ");
  await until(() => c.provider.unsyncedChanges === 0);
  hocuspocus.flushPendingStores();
  await until(() => versions(docId).length === 1); // the doc's first version
  expect(JSON.parse(versions(docId)[0].authors)).toEqual([me.user.id]);

  c.doc.getText("content").insert(0, "more ");
  await until(() => c.provider.unsyncedChanges === 0);
  hocuspocus.flushPendingStores();
  await new Promise((r) => setTimeout(r, 100));
  expect(versions(docId)).toHaveLength(1); // still within 10 minutes while connected

  c.provider.destroy(); // last person leaves: the session's changes become a version
  await until(() => versions(docId).length === 2);
});

it("takes a version once 10 minutes have passed since the last one", () => {
  db.prepare("INSERT INTO documents (id, workspace_id, type, owner_id, updated_at) SELECT 'tv', personal_workspace_id, 'doc', id, 0 FROM users LIMIT 1").run();
  const doc = new Y.Doc();
  noteAuthor("tv", "u1");
  const start = Date.now();
  expect(maybeSnapshot("tv", doc, false, start)).not.toBeNull();
  noteAuthor("tv", "u2");
  expect(maybeSnapshot("tv", doc, false, start + 5 * 60_000)).toBeNull();
  expect(maybeSnapshot("tv", doc, false, start + 11 * 60_000)).not.toBeNull();
  expect(maybeSnapshot("tv", doc, true, start + 12 * 60_000)).toBeNull(); // nothing changed since
  expect(maybeSnapshot("gone", doc, true)).toBeNull();
});
