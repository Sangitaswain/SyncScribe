import { afterAll, beforeAll, expect, it } from "vitest";
import request from "supertest";
import { app } from "../app";
import { connect, startServer, until } from "../test/collabServer";

let srv: Awaited<ReturnType<typeof startServer>>;
beforeAll(async () => {
  srv = await startServer();
});
afterAll(() => srv.close());

const signup = async (name: string) =>
  (await request(app).post("/api/auth/signup").send({ name, email: `${name.toLowerCase()}@example.com`, password: "secret123" })).body;
const as = (a: { token: string }) => ({ Authorization: `Bearer ${a.token}` });

it("sharing a doc notifies the invitee live, and the notification can be read later (J3)", async () => {
  const [ana, bea] = [await signup("Nana"), await signup("Nbea")];
  const { names } = (await request(app).get("/api/sync/all").set(as(ana))).body;
  const docId = names.find((n: string) => n.startsWith("doc:")).slice(4);

  // Bea's app is open: her user doc is always connected
  const beaDevice = await connect(srv.port, `user:${bea.user.id}`, bea.token);
  const live: { type: string; notification: { type: string; payload: Record<string, unknown> } }[] = [];
  beaDevice.provider.on("stateless", ({ payload }: { payload: string }) => live.push(JSON.parse(payload)));

  await request(app).post("/api/shares").set(as(ana)).send({ resourceId: docId, email: "nbea@example.com", role: "editor" }).expect(201);
  await until(() => live.length === 1);
  expect(live[0]).toMatchObject({
    type: "notification",
    notification: { type: "shared", payload: { resourceId: docId, title: "Welcome to SyncScribe", role: "editor", by: "Nana" } },
  });
  beaDevice.provider.destroy();

  const unread = (await request(app).get("/api/notifications?unread=1").set(as(bea)).expect(200)).body.notifications;
  expect(unread).toHaveLength(1);
  await request(app).post("/api/notifications/read").set(as(bea)).send({ ids: [unread[0].id] }).expect(204);
  expect((await request(app).get("/api/notifications?unread=1").set(as(bea))).body.notifications).toEqual([]);
  expect((await request(app).get("/api/notifications").set(as(bea))).body.notifications[0].readAt).not.toBeNull();
  expect((await request(app).get("/api/notifications").set(as(ana))).body.notifications).toEqual([]); // only your own
});

it("mentions notify only people who can read the doc (F5)", async () => {
  const [ana, bea, cal] = [await signup("Mana"), await signup("Mbea"), await signup("Mcal")];
  const { names } = (await request(app).get("/api/sync/all").set(as(ana))).body;
  const docId = names.find((n: string) => n.startsWith("doc:")).slice(4);
  await request(app).post("/api/shares").set(as(ana)).send({ resourceId: docId, email: "mbea@example.com", role: "commenter" }).expect(201);

  const body = { docId, threadId: "t1", userIds: [bea.user.id, cal.user.id, ana.user.id] };
  expect((await request(app).post("/api/mentions").set(as(ana)).send(body).expect(200)).body).toEqual({ notified: 1 });
  const [n] = (await request(app).get("/api/notifications").set(as(bea))).body.notifications.filter((x: { type: string }) => x.type === "mentioned");
  expect(n.payload).toMatchObject({ docId, threadId: "t1", by: "Mana" });
  expect((await request(app).get("/api/notifications").set(as(cal))).body.notifications).toEqual([]); // no access, no notification
  await request(app).post("/api/mentions").set(as(cal)).send(body).expect(404);
});
