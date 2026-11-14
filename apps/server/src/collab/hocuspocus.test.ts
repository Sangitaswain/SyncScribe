import { afterAll, beforeAll, expect, it } from "vitest";
import * as Y from "yjs";
import request from "supertest";
import { app } from "../app";
import { hocuspocus } from "./hocuspocus";
import { fetchState } from "./persistence";
import { connect, startServer, until } from "../test/collabServer";

let srv: Awaited<ReturnType<typeof startServer>>;
let token = "";
let name = "";
beforeAll(async () => {
  srv = await startServer();
  const { body } = await request(app).post("/api/auth/signup").send({ name: "Pat", email: "pat@example.com", password: "secret123" });
  token = body.token;
  name = `user:${body.user.id}`; // a document this user may open
});
afterAll(() => srv.close());

it("relays edits between clients and persists them to SQLite", async () => {
  const a = await connect(srv.port, name, token);
  const b = await connect(srv.port, name, token);
  a.doc.getText("content").insert(0, "hello from A");
  await until(() => b.doc.getText("content").toString() === "hello from A"); // live relay

  hocuspocus.flushPendingStores();
  await until(() => fetchState(name) !== null);
  a.provider.destroy();
  b.provider.destroy();

  // Fresh client after the document left memory: state comes back from the database
  await until(() => !hocuspocus.documents.has(name));
  const stored = new Y.Doc();
  Y.applyUpdate(stored, fetchState(name)!);
  expect(stored.getText("content").toString()).toBe("hello from A");
  const c = await connect(srv.port, name, token);
  expect(c.doc.getText("content").toString()).toBe("hello from A");
  c.provider.destroy();
});
