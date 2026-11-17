import { expect, it } from "vitest";
import request from "supertest";
import { app } from "../app";

it("lists only accessible docs, and only changed ones since a time", async () => {
  const { body: a } = await request(app).post("/api/auth/signup").send({ name: "Al", email: "al@example.com", password: "secret123" });
  const { body: b } = await request(app).post("/api/auth/signup").send({ name: "Bea", email: "bea@example.com", password: "secret123" });
  const auth = { Authorization: `Bearer ${a.token}` };
  await request(app).get("/api/sync/all").expect(401);

  const all = (await request(app).get("/api/sync/all").set(auth).expect(200)).body;
  expect(all.names).toHaveLength(2); // own workspace tree + Welcome doc
  expect(all.names).toContain(`ws:${a.user.personalWorkspaceId}`);
  expect(all.names.some((n: string) => n.includes(b.user.personalWorkspaceId))).toBe(false);

  const later = (await request(app).get(`/api/sync/changed?since=${all.now}`).set(auth).expect(200)).body;
  expect(later.names).toEqual([]);
  await request(app).get("/api/sync/changed?since=abc").set(auth).expect(400);
});
