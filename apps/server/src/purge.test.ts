import { expect, it } from "vitest";
import request from "supertest";
import * as Y from "yjs";
import { WS, wsDoc } from "@syncscribe/shared";
import { app } from "./app";
import { db } from "./db/db";
import { hocuspocus } from "./collab/hocuspocus";
import { pruneVersions, purgeTrash } from "./purge";

const DAY = 24 * 60 * 60 * 1000;

it("empties items that have been in Trash for 30 days, from the tree and the database (B10, BP-9)", async () => {
  const me = (await request(app).post("/api/auth/signup").send({ name: "Tia", email: "tia@example.com", password: "secret123" })).body;
  const ws = wsDoc(me.user.personalWorkspaceId);
  const conn = await hocuspocus.openDirectConnection(ws);
  let oldId = "";
  let recentId = "";
  await conn.transact((doc) => {
    const items = doc.getMap<Y.Map<unknown>>(WS.items);
    oldId = [...items.keys()][0]; // the Welcome doc, deleted 31 days ago
    items.get(oldId)!.set("deletedAt", Date.now() - 31 * DAY);
    recentId = "recent";
    const recent = new Y.Map<unknown>();
    items.set(recentId, recent);
    for (const [k, v] of Object.entries({ type: "doc", parentId: null, createdBy: me.user.id, deletedAt: Date.now() - DAY })) recent.set(k, v);
  });

  expect(await purgeTrash()).toBe(1);
  await conn.transact((doc) => {
    expect(doc.getMap(WS.items).has(oldId)).toBe(false);
    expect(doc.getMap(WS.items).has(recentId)).toBe(true); // only a day in Trash
  });
  await conn.disconnect();
  expect(db.prepare("SELECT 1 FROM documents WHERE id = ?").get(oldId)).toBeUndefined();
  expect(db.prepare("SELECT 1 FROM ydoc_state WHERE name = ?").get(`doc:${oldId}`)).toBeUndefined();
});

it("keeps named versions and the newest 200 automatic ones per doc", () => {
  const add = db.prepare("INSERT INTO versions (id, doc_id, state, name, authors, created_at) VALUES (?, 'dv', x'00', ?, '[]', ?)");
  for (let i = 0; i < 205; i++) add.run(`auto${i}`, null, i);
  add.run("named", "Before the deadline", -1);
  expect(pruneVersions()).toBe(5);
  const left = db.prepare("SELECT id FROM versions WHERE doc_id = 'dv'").all() as { id: string }[];
  expect(left).toHaveLength(201);
  expect(left.map((v) => v.id)).toContain("named");
  expect(left.map((v) => v.id)).not.toContain("auto0"); // the oldest automatic ones go
});
