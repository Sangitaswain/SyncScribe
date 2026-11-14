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
