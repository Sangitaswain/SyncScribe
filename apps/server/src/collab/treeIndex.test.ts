import { afterAll, beforeAll, expect, it } from "vitest";
import request from "supertest";
import * as Y from "yjs";
import { WS } from "@syncscribe/shared";
import { app } from "../app";
import { db } from "../db/db";
import { connect, startServer, until } from "../test/collabServer";

let srv: Awaited<ReturnType<typeof startServer>>;
beforeAll(async () => (srv = await startServer()));
afterAll(() => srv.close());

const signup = async (name: string) =>
  (await request(app).post("/api/auth/signup").send({ name, email: `${name}@example.com`, password: "secret123" })).body;
const row = (id: string) => db.prepare("SELECT * FROM documents WHERE id = ?").get(id) as Record<string, unknown> | undefined;

it("indexes the Welcome doc at sign-up and docs created over sync", async () => {
  const me = await signup("ivy");
  const welcome = db.prepare("SELECT * FROM documents WHERE workspace_id = ?").all(me.user.personalWorkspaceId) as { title: string }[];
  expect(welcome.map((d) => d.title)).toEqual(["Welcome to SyncScribe"]);

  const { doc, provider } = await connect(srv.port, `ws:${me.user.personalWorkspaceId}`, me.token);
  const item = new Y.Map<unknown>();
  doc.getMap<Y.Map<unknown>>(WS.items).set("newdoc1", item);
  item.set("type", "doc");
  item.set("parentId", null);
  item.set("createdBy", me.user.id);
  await until(() => row("newdoc1") !== undefined);
  expect(row("newdoc1")).toMatchObject({ workspace_id: me.user.personalWorkspaceId, owner_id: me.user.id, type: "doc" });

  // Now the doc itself can be opened over sync
  (await connect(srv.port, "doc:newdoc1", me.token)).provider.destroy();
  provider.destroy();
});

it("won't let a doc id from someone else's workspace be claimed", async () => {
  const victim = await signup("vic");
  const attacker = await signup("eve");
  const victimDoc = (db.prepare("SELECT id FROM documents WHERE workspace_id = ?").get(victim.user.personalWorkspaceId) as { id: string }).id;

  const { doc, provider } = await connect(srv.port, `ws:${attacker.user.personalWorkspaceId}`, attacker.token);
  const item = new Y.Map<unknown>();
  doc.getMap<Y.Map<unknown>>(WS.items).set(victimDoc, item);
  item.set("type", "doc");
  item.set("createdBy", attacker.user.id);
  await new Promise((r) => setTimeout(r, 200));
  expect(row(victimDoc)!.workspace_id).toBe(victim.user.personalWorkspaceId);
  await expect(connect(srv.port, `doc:${victimDoc}`, attacker.token)).rejects.toThrow("forbidden");
  provider.destroy();
});
