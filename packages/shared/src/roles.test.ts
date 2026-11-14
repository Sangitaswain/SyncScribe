import { describe, expect, it } from "vitest";
import { can, maxRole, type Capability, type Role } from "./roles";

// Expected table from BACKEND_PLAN.md BP-4.2
const table: Record<Role, Capability[]> = {
  owner: ["read", "writeDoc", "writeComments", "invite", "manageAccess", "purge"],
  editor: ["read", "writeDoc", "writeComments", "invite"],
  commenter: ["read", "writeComments"],
  viewer: ["read"],
  none: [],
};
const all: Capability[] = ["read", "writeDoc", "writeComments", "invite", "manageAccess", "purge"];

describe("can", () => {
  for (const [role, allowed] of Object.entries(table) as [Role, Capability[]][]) {
    for (const cap of all) {
      it(`${role} ${allowed.includes(cap) ? "can" : "cannot"} ${cap}`, () => {
        expect(can(role, cap)).toBe(allowed.includes(cap));
      });
    }
  }
});

describe("maxRole", () => {
  it("picks the highest role", () => {
    expect(maxRole("viewer", "editor", "commenter")).toBe("editor");
    expect(maxRole()).toBe("none");
  });
});
