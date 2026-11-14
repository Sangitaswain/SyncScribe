import { describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../app";

const priya = { name: "Priya", email: "priya@example.com", password: "secret123" };

describe("auth", () => {
  it("signs up with a personal workspace", async () => {
    const res = await request(app).post("/api/auth/signup").send(priya).expect(201);
    expect(res.body.user).toMatchObject({ name: "Priya", email: "priya@example.com" });
    expect(res.body.user.password_hash).toBeUndefined();
    expect(res.body.token).toBeTypeOf("string");
    expect(res.body.workspaces).toEqual([
      { id: res.body.user.personalWorkspaceId, name: "Priya's workspace", kind: "personal", role: "owner" },
    ]);
  });

  it("rejects a duplicate email (any case)", async () => {
    const res = await request(app).post("/api/auth/signup").send({ ...priya, email: "PRIYA@example.com" }).expect(409);
    expect(res.body.error.code).toBe("email_taken");
  });

  it("rejects invalid signup input", async () => {
    await request(app).post("/api/auth/signup").send({ ...priya, email: "x@y.co", password: "short" }).expect(400);
  });

  it("logs in and rejects a wrong password", async () => {
    const ok = await request(app).post("/api/auth/login").send({ email: priya.email, password: priya.password }).expect(200);
    expect(ok.body.user.name).toBe("Priya");
    const bad = await request(app).post("/api/auth/login").send({ email: priya.email, password: "nope1234" }).expect(401);
    expect(bad.body.error.code).toBe("bad_credentials");
  });
});
