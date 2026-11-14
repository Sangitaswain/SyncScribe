export const ROLES = ["none", "viewer", "commenter", "editor", "owner"] as const;
export type Role = (typeof ROLES)[number];
export type ShareRole = Exclude<Role, "none" | "owner">;

export type Capability = "read" | "writeDoc" | "writeComments" | "invite" | "manageAccess" | "purge";

const MIN_ROLE: Record<Capability, Role> = {
  read: "viewer",
  writeComments: "commenter",
  writeDoc: "editor",
  invite: "editor",
  manageAccess: "owner",
  purge: "owner",
};

export const rank = (role: Role) => ROLES.indexOf(role);

export const can = (role: Role, capability: Capability) => rank(role) >= rank(MIN_ROLE[capability]);

export const maxRole = (...roles: Role[]): Role =>
  roles.reduce((best, r) => (rank(r) > rank(best) ? r : best), "none");
