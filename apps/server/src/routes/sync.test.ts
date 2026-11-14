import { expect, it } from "vitest";
import request from "supertest";
import * as Y from "yjs";
import { DOC } from "@syncscribe/shared";
import { app } from "../app";

it("bootstraps a new device with the user's workspace and Welcome document", async () => {
  const { body: me } = await request(app).post("/api/auth/signup").send({ name: "Mo", email: "mo@example.com", password: "secret123" });
  await request(app).post("/api/auth/signup").send({ name: "Zed", email: "zed@example.com", password: "secret123" });
  await request(app).get("/api/sync/bootstrap").expect(401);

  const { body } = await request(app).get("/api/sync/bootstrap").set("Authorization", `Bearer ${me.token}`).expect(200);
  const names = Object.keys(body.docs);
  expect(names).toContain(`ws:${me.user.personalWorkspaceId}`);
  expect(names).toHaveLength(2); // own tree + Welcome doc, nothing of Zed's

  const welcome = new Y.Doc();
  Y.applyUpdate(welcome, Buffer.from(body.docs[names.find((n) => n.startsWith("doc:"))!], "base64"));
  expect(welcome.getMap(DOC.meta).get("title")).toBe("Welcome to SyncScribe");
});

it("lists only accessible docs, and only changed ones since a time", async () => {
  const { body: a } = await request(app).post("/api/auth/signup").send({ name: "Al", email: "al@example.com", password: "secret123" });
  const { body: b } = await request(app).post("/api/auth/signup").send({ name: "Bea", email: "bea@example.com", password: "secret123" });
  const auth = { Authorization: `Bearer ${a.token}` };

  const all = (await request(app).get("/api/sync/all").set(auth).expect(200)).body;
  expect(all.names).toHaveLength(2); // own workspace tree + Welcome doc
  expect(all.names).toContain(`ws:${a.user.personalWorkspaceId}`);
  expect(all.names.some((n: string) => n.includes(b.user.personalWorkspaceId))).toBe(false);

  const later = (await request(app).get(`/api/sync/changed?since=${all.now}`).set(auth).expect(200)).body;
  expect(later.names).toEqual([]);
  await request(app).get("/api/sync/changed?since=abc").set(auth).expect(400);
});
