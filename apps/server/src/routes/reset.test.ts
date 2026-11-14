import { expect, it } from "vitest";
import request from "supertest";
import { app } from "../app";
import { sentMail } from "../mail/mailer";

it("resets a password with an emailed link, once", async () => {
  await request(app).post("/api/auth/signup").send({ name: "Lena", email: "lena@example.com", password: "oldpass123" });

  await request(app).post("/api/auth/forgot").send({ email: "nobody@example.com" }).expect(200);
  expect(sentMail).toHaveLength(0);

  await request(app).post("/api/auth/forgot").send({ email: "lena@example.com" }).expect(200);
  const token = /\/reset\/([0-9a-f]+)/.exec(sentMail[0].text)![1];

  await request(app).post("/api/auth/reset").send({ token, password: "newpass123" }).expect(200);
  await request(app).post("/api/auth/reset").send({ token, password: "another123" }).expect(400);

  await request(app).post("/api/auth/login").send({ email: "lena@example.com", password: "oldpass123" }).expect(401);
  await request(app).post("/api/auth/login").send({ email: "lena@example.com", password: "newpass123" }).expect(200);
});
