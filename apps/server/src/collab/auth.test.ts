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

it("discards edits from read-only connections: viewers and commenters on docs, viewers on comments (G5, EC18)", async () => {
  const share = (user: string, role: string) =>
    db.prepare("INSERT OR REPLACE INTO shares (id, resource_id, user_id, role, created_by, created_at) VALUES (?, 'd1', ?, ?, ?, 0)").run(
      `d1-${user}`,
      user,
      role,
      me.user.id,
    );
  const settle = () => new Promise((r) => setTimeout(r, 300));
  const triesToWrite = async (name: string, text: string) => {
    const owner = await connect(srv.port, name, me.token);
    const guest = await connect(srv.port, name, other.token);
    guest.doc.getText("content").insert(0, text);
    await settle();
    const relayed = owner.doc.getText("content").toString().includes(text);
    owner.provider.destroy();
    guest.provider.destroy();
    const fresh = await connect(srv.port, name, me.token); // what the server kept
    const stored = fresh.doc.getText("content").toString().includes(text);
    fresh.provider.destroy();
    return relayed || stored;
  };

  share(other.user.id, "viewer");
  expect(await triesToWrite("doc:d1", "viewer edit")).toBe(false);
  expect(await triesToWrite("cm:d1", "viewer comment")).toBe(false);

  share(other.user.id, "commenter");
  expect(await triesToWrite("doc:d1", "commenter edit")).toBe(false);
  expect(await triesToWrite("cm:d1", "commenter comment")).toBe(true);

  share(other.user.id, "editor");
  expect(await triesToWrite("doc:d1", "editor edit")).toBe(true);
});
