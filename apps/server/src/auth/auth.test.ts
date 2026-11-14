import { expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password";
import { signToken, verifyToken } from "./jwt";

const user = { id: "u1", name: "Priya", color: "#e11d48" };

it("hashes and verifies passwords", async () => {
  const hash = await hashPassword("secret123");
  expect(hash).not.toContain("secret123");
  expect(await verifyPassword("secret123", hash)).toBe(true);
  expect(await verifyPassword("wrong", hash)).toBe(false);
});

it("signs and verifies a token", async () => {
  expect(await verifyToken(await signToken(user))).toEqual(user);
});

it("rejects expired and tampered tokens", async () => {
  const expired = await signToken(user, "-1s");
  await expect(verifyToken(expired)).rejects.toThrow("token-expired");
  await expect(verifyToken(expired.slice(0, -2) + "xx")).rejects.toThrow(/invalid-token|token-expired/);
  await expect(verifyToken("garbage")).rejects.toThrow("invalid-token");
});
