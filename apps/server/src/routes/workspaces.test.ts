import { expect, it } from "vitest";
import request from "supertest";
import { app } from "../app";

type Account = { token: string; user: { id: string; personalWorkspaceId: string } };
const signup = async (name: string): Promise<Account> =>
  (await request(app).post("/api/auth/signup").send({ name, email: `${name.toLowerCase()}@example.com`, password: "secret123" })).body;
const as = (a: Account) => ({ Authorization: `Bearer ${a.token}` });

it("creates a team workspace and manages its members (B2)", async () => {
  const [olu, mia, sam] = [await signup("Olu"), await signup("Mia"), await signup("Sam")];
  const team = (await request(app).post("/api/workspaces").set(as(olu)).send({ name: "Lab group" }).expect(201)).body;
  expect(team).toMatchObject({ name: "Lab group", kind: "team", role: "owner" });
  await request(app).post("/api/workspaces").set(as(olu)).send({ name: " " }).expect(400);

  // Invite Mia; she now belongs to it and can sync its tree
  const members = `/api/workspaces/${team.id}/members`;
  await request(app).post(members).set(as(olu)).send({ email: "nobody@example.com", role: "editor" }).expect(404);
  expect((await request(app).post(members).set(as(olu)).send({ email: "mia@example.com", role: "editor" }).expect(201)).body).toMatchObject({
    userId: mia.user.id,
    role: "editor",
  });
  expect((await request(app).get("/api/workspaces").set(as(mia))).body.workspaces.map((w: { id: string }) => w.id)).toContain(team.id);
  expect((await request(app).get("/api/sync/all").set(as(mia))).body.names).toContain(`ws:${team.id}`);

  // Members can see the list; only the owner changes it
  const list = (await request(app).get(members).set(as(mia)).expect(200)).body.members;
  expect(list.map((m: { name: string; role: string }) => `${m.name}:${m.role}`)).toEqual(["Olu:owner", "Mia:editor"]);
  await request(app).get(members).set(as(sam)).expect(404);
  await request(app).post(members).set(as(mia)).send({ email: "sam@example.com", role: "viewer" }).expect(403);
  await request(app).patch(`${members}/${olu.user.id}`).set(as(olu)).send({ role: "viewer" }).expect(400); // owner stays owner
  await request(app).patch(`${members}/${mia.user.id}`).set(as(olu)).send({ role: "viewer" }).expect(200);
  expect((await request(app).get(members).set(as(olu))).body.members[1].role).toBe("viewer");
  await request(app).delete(`${members}/${mia.user.id}`).set(as(olu)).expect(204);
  await request(app).get(members).set(as(mia)).expect(404);

  // Personal workspaces don't take members
  await request(app)
    .post(`/api/workspaces/${olu.user.personalWorkspaceId}/members`)
    .set(as(olu))
    .send({ email: "sam@example.com", role: "viewer" })
    .expect(400);
});

it("lists documents shared with me", async () => {
  const [kai, lee] = [await signup("Kai"), await signup("Lee")];
  const { names } = (await request(app).get("/api/sync/all").set(as(kai))).body;
  const docId = names.find((n: string) => n.startsWith("doc:")).slice(4);
  expect((await request(app).get("/api/shared-with-me").set(as(lee)).expect(200)).body.items).toEqual([]);
  await request(app).post("/api/shares").set(as(kai)).send({ resourceId: docId, email: "lee@example.com", role: "viewer" }).expect(201);
  expect((await request(app).get("/api/shared-with-me").set(as(lee))).body.items).toEqual([
    { id: docId, type: "doc", title: "Welcome to SyncScribe", role: "viewer", ownerName: "Kai" },
  ]);
  await request(app).get("/api/shared-with-me").expect(401);
});
