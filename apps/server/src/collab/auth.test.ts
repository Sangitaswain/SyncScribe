import { afterAll, beforeAll, expect, it } from "vitest";
import request from "supertest";
import { app } from "../app";
import { signToken } from "../auth/jwt";
import { db } from "../db/db";
import { connect, startServer } from "../test/collabServer";

let srv: Awaited<ReturnType<typeof startServer>>;
let me: { token: string; user: { id: string; personalWorkspaceId: string } };
let other: typeof me;
beforeAll(async () => {
  srv = await startServer();
  me = (await request(app).post("/api/auth/signup").send({ name: "Ana", email: "ana@example.com", password: "secret123" })).body;
  other = (await request(app).post("/api/auth/signup").send({ name: "Bo", email: "bo@example.com", password: "secret123" })).body;
});
afterAll(() => srv.close());

it("refuses bad and expired tokens", async () => {
  await expect(connect(srv.port, `ws:${me.user.personalWorkspaceId}`, "garbage")).rejects.toThrow("invalid-token");
  const expired = await signToken({ id: me.user.id, name: "Ana", color: "#000000" }, "-1s");
  await expect(connect(srv.port, `ws:${me.user.personalWorkspaceId}`, expired)).rejects.toThrow("token-expired");
});

it("lets members open their workspace and user docs, nobody else's", async () => {
  const ok = await connect(srv.port, `ws:${me.user.personalWorkspaceId}`, me.token);
  expect(ok.provider.isSynced).toBe(true);
  ok.provider.destroy();
  (await connect(srv.port, `user:${me.user.id}`, me.token)).provider.destroy();

  await expect(connect(srv.port, `ws:${other.user.personalWorkspaceId}`, me.token)).rejects.toThrow("forbidden");
  await expect(connect(srv.port, `user:${other.user.id}`, me.token)).rejects.toThrow("forbidden");
});

it("asks to retry for documents the server doesn't know yet, and checks known ones", async () => {
  await expect(connect(srv.port, "doc:not-indexed-yet", me.token)).rejects.toThrow("unknown-doc");
  db.prepare("INSERT INTO documents (id, workspace_id, type, owner_id, updated_at) VALUES ('d1', ?, 'doc', ?, 0)").run(
    me.user.personalWorkspaceId, me.user.id,
  );
  (await connect(srv.port, "doc:d1", me.token)).provider.destroy();
  await expect(connect(srv.port, "doc:d1", other.token)).rejects.toThrow("forbidden");
});
