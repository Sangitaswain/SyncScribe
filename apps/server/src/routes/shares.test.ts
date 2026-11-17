import { afterAll, beforeAll, expect, it } from "vitest";
import request from "supertest";
import { app } from "../app";
import { sentMail } from "../mail/mailer";
import { connect, startServer, until } from "../test/collabServer";

let srv: Awaited<ReturnType<typeof startServer>>;
type Account = { token: string; user: { id: string } };
let ana: Account, ed: Account, vi: Account;
let docId = "";

const signup = async (name: string) =>
  (await request(app).post("/api/auth/signup").send({ name, email: `${name.toLowerCase()}@example.com`, password: "secret123" })).body;
const as = (a: Account) => ({ Authorization: `Bearer ${a.token}` });
const invite = (by: Account, email: string, role: string) =>
  request(app).post("/api/shares").set(as(by)).send({ resourceId: docId, email, role });

beforeAll(async () => {
  srv = await startServer();
  [ana, ed, vi] = [await signup("Ana"), await signup("Ed"), await signup("Vi")];
  const { names } = (await request(app).get("/api/sync/all").set(as(ana))).body;
  docId = names.find((n: string) => n.startsWith("doc:")).slice(4); // Ana's Welcome doc
});
afterAll(() => srv.close());

it("owners and editors invite; only owners change or remove access (G1, G2, G4)", async () => {
  await request(app).get(`/api/shares?resource=${docId}`).set(as(ed)).expect(404); // no access yet
  const edShare = (await invite(ana, "ed@example.com", "editor").expect(201)).body;
  expect(edShare).toMatchObject({ userId: ed.user.id, name: "Ed", role: "editor" });

  // Ed can now see who has access and invite up to editor, but not change anyone's access
  const viShare = (await invite(ed, "vi@example.com", "viewer").expect(201)).body;
  const listed = (await request(app).get(`/api/shares?resource=${docId}`).set(as(ed)).expect(200)).body;
  expect(listed.role).toBe("editor");
  expect(listed.shares).toHaveLength(2);
  await invite(ed, "vi@example.com", "owner").expect(400); // share roles stop at editor
  await request(app).patch(`/api/shares/${viShare.id}`).set(as(ed)).send({ role: "editor" }).expect(403);
  await request(app).delete(`/api/shares/${viShare.id}`).set(as(ed)).expect(403);

  // Vi (viewer) can't invite; Ana changes and removes access
  await invite(vi, "x@example.com", "viewer").expect(403);
  expect((await request(app).patch(`/api/shares/${viShare.id}`).set(as(ana)).send({ role: "commenter" }).expect(200)).body.role).toBe(
    "commenter",
  );
  await request(app).delete(`/api/shares/${viShare.id}`).set(as(ana)).expect(204);
  await request(app).delete(`/api/shares/${edShare.id}`).set(as(ana)).expect(204);
});

it("an invite to an email with no account waits for sign-up (EC22)", async () => {
  const share = (await invite(ana, "newbie@example.com", "viewer").expect(201)).body;
  expect(share).toMatchObject({ userId: null, email: "newbie@example.com" });
  expect(sentMail.at(-1)).toMatchObject({ to: "newbie@example.com" });
  expect(sentMail.at(-1)!.text).toContain("/signup");

  const newbie = await signup("Newbie");
  const { names } = (await request(app).get("/api/sync/all").set(as(newbie))).body;
  expect(names).toContain(`doc:${docId}`); // the shared doc is now theirs to download
});

it("a downgrade makes the open doc read-only, a removal refuses it (EC16, EC17)", async () => {
  const share = (await invite(ana, "ed@example.com", "editor").expect(201)).body;
  const owner = await connect(srv.port, `doc:${docId}`, ana.token);
  const guest = await connect(srv.port, `doc:${docId}`, ed.token);
  const told: string[] = [];
  guest.provider.on("stateless", ({ payload }: { payload: string }) => told.push(JSON.parse(payload).type));
  let closed = false;
  guest.provider.on("close", () => (closed = true));

  await request(app).patch(`/api/shares/${share.id}`).set(as(ana)).send({ role: "viewer" }).expect(200);
  await until(() => closed && told.includes("role-changed"));
  guest.provider.destroy();

  // Reconnecting gives a read-only connection: Ed's edit never reaches Ana
  const again = await connect(srv.port, `doc:${docId}`, ed.token);
  again.doc.getText("content").insert(0, "edit after downgrade ");
  await new Promise((r) => setTimeout(r, 300));
  expect(owner.doc.getText("content").toString()).not.toContain("edit after downgrade");

  await request(app).delete(`/api/shares/${share.id}`).set(as(ana)).expect(204);
  await expect(connect(srv.port, `doc:${docId}`, ed.token)).rejects.toThrow("forbidden");
  for (const c of [owner, again]) c.provider.destroy();
});

it("share links give their role until revoked, then say the link is no longer active (G3, EC23)", async () => {
  const link = (role: string, by = ana) => request(app).post("/api/share-links").set(as(by)).send({ resourceId: docId, role });
  await link("viewer", vi).expect(404); // Vi has no access
  const created = (await link("commenter").expect(201)).body;
  expect(created.url).toMatch(/\/s\/[\w-]{20,}$/);
  const token = created.url.split("/s/")[1];
  const active = () => request(app).get(`/api/share-links?resource=${docId}`).set(as(ana));
  expect((await active().expect(200)).body.links).toEqual([{ id: created.id, resourceId: docId, role: "commenter", revoked: false }]);

  const visitor = await signup("Visitor");
  const accepted = (await request(app).post(`/api/share-links/${token}/accept`).set(as(visitor)).expect(200)).body;
  expect(accepted).toEqual({ resourceId: docId, role: "commenter" });
  await request(app).post(`/api/share-links/${token}/accept`).expect(401); // must be signed in

  await request(app).delete(`/api/share-links/${created.id}`).set(as(visitor)).expect(403); // only the owner revokes
  await request(app).delete(`/api/share-links/${created.id}`).set(as(ana)).expect(204);
  expect((await active()).body.links).toEqual([]);
  const late = await signup("Late");
  const gone = await request(app).post(`/api/share-links/${token}/accept`).set(as(late)).expect(410);
  expect(gone.body.error).toEqual({ code: "link_inactive", message: "This link is no longer active" });
  await request(app).post("/api/share-links/made-up-token/accept").set(as(late)).expect(410);
});
