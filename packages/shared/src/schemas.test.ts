import { expect, it } from "vitest";
import { shareCreateSchema, signupSchema } from "./index";

it("accepts a valid signup and rejects a short password", () => {
  expect(signupSchema.safeParse({ name: "Priya", email: "priya@example.com", password: "secret123" }).success).toBe(true);
  expect(signupSchema.safeParse({ name: "Priya", email: "priya@example.com", password: "short" }).success).toBe(false);
});

it("rejects owner as a share role", () => {
  expect(shareCreateSchema.safeParse({ resourceId: "d1", email: "a@b.co", role: "owner" }).success).toBe(false);
});
