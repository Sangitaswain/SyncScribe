import type { AuthResponse, Role, User, Workspace } from "@syncscribe/shared";
import { db } from "./db/db";
import { signToken } from "./auth/jwt";

export interface UserRow {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  color: string;
  personal_workspace_id: string;
}

export const toUser = (r: UserRow): User => ({
  id: r.id,
  email: r.email,
  name: r.name,
  color: r.color,
  personalWorkspaceId: r.personal_workspace_id,
});

export const userById = (id: string) => db.prepare("SELECT * FROM users WHERE id = ?").get(id) as UserRow | undefined;
export const userByEmail = (email: string) =>
  db.prepare("SELECT * FROM users WHERE email = ?").get(email) as UserRow | undefined;

export const workspacesFor = (userId: string) =>
  db
    .prepare(
      `SELECT w.id, w.name, w.kind, m.role FROM workspaces w
       JOIN workspace_members m ON m.workspace_id = w.id WHERE m.user_id = ? ORDER BY w.created_at`,
    )
    .all(userId) as (Workspace & { role: Role })[];

export const authResponse = async (r: UserRow): Promise<AuthResponse> => ({
  user: toUser(r),
  token: await signToken(r),
  workspaces: workspacesFor(r.id),
});
