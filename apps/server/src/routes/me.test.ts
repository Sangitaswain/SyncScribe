import { beforeAll, expect, it } from "vitest";
import request from "supertest";
import { app } from "../app";

let token = "";
beforeAll(async () => {
  const res = await request(app).post("/api/auth/signup").send({ name: "Ali", email: "ali@example.com", password: "secret123" });
  token = res.body.token;
});
const auth = () => ({ Authorization: `Bearer ${token}` });

it("requires a token", async () => {
  await request(app).get("/api/me").expect(401);
  await request(app).get("/api/me").set({ Authorization: "Bearer junk" }).expect(401);
});

it("returns the profile", async () => {
  const res = await request(app).get("/api/me").set(auth()).expect(200);
  expect(res.body.user.name).toBe("Ali");
  expect(res.body.workspaces).toHaveLength(1);
});

it("updates name and colour and returns a new token", async () => {
  const res = await request(app).patch("/api/me").set(auth()).send({ name: "Ali K", color: "#16a34a" }).expect(200);
  expect(res.body.user).toMatchObject({ name: "Ali K", color: "#16a34a" });
  await request(app).patch("/api/me").set(auth()).send({ color: "red" }).expect(400);
});

it("refreshes the token", async () => {
  const res = await request(app).post("/api/auth/refresh").set(auth()).expect(200);
  expect(res.body.token).toBeTypeOf("string");
  expect(res.body.user.name).toBe("Ali K");
});
