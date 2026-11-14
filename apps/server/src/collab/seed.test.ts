import { expect, it } from "vitest";
import * as Y from "yjs";
import { DOC, WS } from "@syncscribe/shared";
import { db } from "../db/db";
import { seedWorkspace } from "./seed";

const load = (name: string) => {
  const row = db.prepare("SELECT state FROM ydoc_state WHERE name = ?").get(name) as { state: Buffer };
  const doc = new Y.Doc();
  Y.applyUpdate(doc, row.state);
  return doc;
};

it("seeds a personal workspace with a Welcome document", () => {
  seedWorkspace({ workspaceId: "w1", userId: "u1", name: "Priya's workspace", kind: "personal" });
  const ws = load("ws:w1");
  const items = [...ws.getMap<Y.Map<unknown>>(WS.items).entries()];
  expect(items).toHaveLength(1);
  const [docId, item] = items[0];
  expect(item.get("type")).toBe("doc");
  expect(item.get("parentId")).toBeNull();

  const doc = load(`doc:${docId}`);
  expect(doc.getMap(DOC.meta).get("title")).toBe("Welcome to SyncScribe");
  expect(doc.getText(DOC.content).toString()).toContain("with or without an internet connection");
});

it("seeds an empty team workspace", () => {
  seedWorkspace({ workspaceId: "w2", userId: "u1", name: "Team", kind: "team" });
  expect(load("ws:w2").getMap(WS.items).size).toBe(0);
  expect(load("ws:w2").getMap(WS.info).get("kind")).toBe("team");
});
