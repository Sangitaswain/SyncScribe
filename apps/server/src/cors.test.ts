import { expect, it } from "vitest";
import request from "supertest";
import { app } from "./app";

const allowed = async (origin: string) =>
  (await request(app).options("/api/health").set("Origin", origin).set("Access-Control-Request-Method", "GET"))
    .headers["access-control-allow-origin"];

it("allows the app on any localhost port and blocks other sites", async () => {
  expect(await allowed("http://localhost:5173")).toBe("http://localhost:5173");
  expect(await allowed("http://localhost:5174")).toBe("http://localhost:5174");
  expect(await allowed("http://127.0.0.1:4173")).toBe("http://127.0.0.1:4173");
  expect(await allowed("https://evil.example")).toBeUndefined();
});
