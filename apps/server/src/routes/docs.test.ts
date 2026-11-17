import { expect, it } from "vitest";
import request from "supertest";
import { app } from "../app";
import { db } from "../db/db";
import { storeState } from "../collab/persistence";

const signup = async (name: string) =>
  (await request(app).post("/api/auth/signup").send({ name, email: `${name.toLowerCase()}@example.com`, password: "secret123" })).body;
const count = (sql: string, ...args: unknown[]) => (db.prepare(`SELECT COUNT(*) AS n FROM ${sql}`).get(...args) as { n: number }).n;

it("only the owner deletes permanently, and everything stored for the doc goes (B10, BP-5.4)", async () => {
  const [own, ed, stranger] = [await signup("Own"), await signup("Ed"), await signup("Str")];
  const ws = own.user.personalWorkspaceId;
  // A folder holding the doc to delete, plus comments, a version, a share and a link for that doc
  db.prepare("INSERT INTO documents (id, workspace_id, parent_id, type, owner_id, updated_at) VALUES ('f1', ?, NULL, 'folder', ?, 0), ('d1', ?, 'f1', 'doc', ?, 0)").run(
    ws, own.user.id, ws, own.user.id,
  );
  for (const name of ["doc:d1", "cm:d1"]) storeState(name, new Uint8Array([0, 0]));
  db.prepare("INSERT INTO versions (id, doc_id, state, authors, created_at) VALUES ('v1', 'd1', x'00', '[]', 0)").run();
  db.prepare("INSERT INTO share_links (id, token_hash, resource_id, role, created_by, created_at) VALUES ('l1', 'h', 'd1', 'viewer', ?, 0)").run(own.user.id);
  await request(app).post("/api/shares").set("Authorization", `Bearer ${own.token}`).send({ resourceId: "d1", email: "ed@example.com", role: "editor" }).expect(201);

  await request(app).delete("/api/docs/f1").set("Authorization", `Bearer ${stranger.token}`).expect(404);
  await request(app).delete("/api/docs/d1").set("Authorization", `Bearer ${ed.token}`).expect(403); // editors can't
  await request(app).delete("/api/docs/f1").set("Authorization", `Bearer ${own.token}`).expect(204); // the folder and what's in it

  expect(count("documents WHERE id IN ('f1', 'd1')")).toBe(0);
  expect(count("ydoc_state WHERE name IN ('doc:d1', 'cm:d1')")).toBe(0);
  expect(count("versions WHERE doc_id = 'd1'")).toBe(0);
  expect(count("shares WHERE resource_id = 'd1'")).toBe(0);
  expect(count("share_links WHERE resource_id = 'd1'")).toBe(0);

  storeState("doc:d1", new Uint8Array([0, 0])); // a late save from a client that still had it open
  expect(count("ydoc_state WHERE name = 'doc:d1'")).toBe(0);
});

it("lists, names, renames and returns versions; viewers read, editors write (H1, H4)", async () => {
  const Y = await import("yjs");
  const [own, vi, nobody] = [await signup("Vown"), await signup("Vview"), await signup("Vno")];
  const as = (a: { token: string }) => ({ Authorization: `Bearer ${a.token}` });
  const { names } = (await request(app).get("/api/sync/all").set(as(own))).body;
  const docId = names.find((n: string) => n.startsWith("doc:")).slice(4);
  await request(app).post("/api/shares").set(as(own)).send({ resourceId: docId, email: "vview@example.com", role: "viewer" }).expect(201);

  const v = (await request(app).post(`/api/docs/${docId}/versions`).set(as(own)).send({ name: "Before review" }).expect(201)).body;
  expect(v).toMatchObject({ docId, name: "Before review", authors: ["Vown"] });
  await request(app).post(`/api/docs/${docId}/versions`).set(as(vi)).send({ name: "Mine" }).expect(403);
  await request(app).post(`/api/docs/${docId}/versions`).set(as(own)).send({ name: " " }).expect(400);

  const list = (await request(app).get(`/api/docs/${docId}/versions`).set(as(vi)).expect(200)).body.versions;
  expect(list.map((x: { id: string }) => x.id)).toContain(v.id);
  await request(app).get(`/api/docs/${docId}/versions`).set(as(nobody)).expect(404);

  // The stored state decodes into the document as it was
  const { body } = await request(app)
    .get(`/api/versions/${v.id}`)
    .set(as(vi))
    .buffer(true)
    .parse((res, cb) => {
      const chunks: Buffer[] = [];
      res.on("data", (c: Buffer) => chunks.push(c));
      res.on("end", () => cb(null, Buffer.concat(chunks)));
    })
    .expect(200);
  const doc = new Y.Doc();
  Y.applyUpdate(doc, new Uint8Array(body));
  expect(doc.getMap("meta").get("title")).toBe("Welcome to SyncScribe");

  await request(app).patch(`/api/versions/${v.id}`).set(as(vi)).send({ name: "x" }).expect(403);
  expect((await request(app).patch(`/api/versions/${v.id}`).set(as(own)).send({ name: "Final draft" }).expect(200)).body.name).toBe("Final draft");
  await request(app).get("/api/versions/nope").set(as(own)).expect(404);
});
