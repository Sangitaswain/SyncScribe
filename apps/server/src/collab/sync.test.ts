import { afterAll, beforeAll, expect, it } from "vitest";
import * as Y from "yjs";
import request from "supertest";
import { app } from "../app";
import { hocuspocus } from "./hocuspocus";
import { fetchState } from "./persistence";
import { connect, startServer, until } from "../test/collabServer";

// Live sync through the real server (BP-12). Offline merging, read-only connections, share revocation and
// snapshots have their own files: offlineMerge, auth, routes/shares and versions tests.

let srv: Awaited<ReturnType<typeof startServer>>;
beforeAll(async () => {
  srv = await startServer();
});
afterAll(() => srv.close());

const signup = async (name: string) =>
  (await request(app).post("/api/auth/signup").send({ name, email: `${name.toLowerCase()}@example.com`, password: "secret123" })).body;
const as = (a: { token: string }) => ({ Authorization: `Bearer ${a.token}` });

it("two people typing at the same spot at once end with the same text, and the server keeps it (EC7, E4)", async () => {
  const [ana, bo] = [await signup("Sana"), await signup("Sbo")];
  const team = (await request(app).post("/api/workspaces").set(as(ana)).send({ name: "Live" })).body;
  await request(app).post(`/api/workspaces/${team.id}/members`).set(as(ana)).send({ email: "sbo@example.com", role: "editor" }).expect(201);
  const name = `ws:${team.id}`;

  const a = await connect(srv.port, name, ana.token);
  const b = await connect(srv.port, name, bo.token);
  a.doc.getText("notes").insert(0, "Ana ");
  b.doc.getText("notes").insert(0, "Bo ");
  await until(() => a.doc.getText("notes").length === 7 && b.doc.getText("notes").length === 7);
  expect(a.doc.getText("notes").toString()).toBe(b.doc.getText("notes").toString());

  hocuspocus.flushPendingStores();
  await until(() => {
    const stored = new Y.Doc();
    const state = fetchState(name);
    if (state) Y.applyUpdate(stored, state);
    return stored.getText("notes").toString() === a.doc.getText("notes").toString();
  });
  a.provider.destroy();
  b.provider.destroy();
});

it("removing a member closes their workspace connection; reconnecting is refused (EC16)", async () => {
  const [own, mem] = [await signup("Rown"), await signup("Rmem")];
  const team = (await request(app).post("/api/workspaces").set(as(own)).send({ name: "Closing" })).body;
  await request(app).post(`/api/workspaces/${team.id}/members`).set(as(own)).send({ email: "rmem@example.com", role: "editor" }).expect(201);

  const c = await connect(srv.port, `ws:${team.id}`, mem.token);
  let closed = false;
  c.provider.on("close", () => (closed = true));
  await request(app).delete(`/api/workspaces/${team.id}/members/${mem.user.id}`).set(as(own)).expect(204);
  await until(() => closed);
  c.provider.destroy();
  await expect(connect(srv.port, `ws:${team.id}`, mem.token)).rejects.toThrow("forbidden");
});
