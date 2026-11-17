import { Router } from "express";
import { nanoid } from "nanoid";
import { memberInviteSchema, roleUpdateSchema, workspaceCreateSchema, type Member, type Role, type Workspace } from "@syncscribe/shared";
import { db } from "../db/db";
import { HttpError } from "../errors";
import { currentUser, requireAuth } from "../auth/middleware";
import { workspaceRole } from "../permissions/resolve";
import { userByEmail, workspacesFor } from "../users";
import { seedWorkspace } from "../collab/seed";
import { closeConnectionsFor } from "../collab/access";

// Team workspaces and their members (BP-5.2, B2)

export const workspacesRouter = Router();
workspacesRouter.use(requireAuth);

/** The caller's role in the workspace; 404 if they are not a member. */
function memberRole(userId: string, workspaceId: string) {
  const role = workspaceRole(userId, workspaceId);
  if (role === "none") throw new HttpError(404, "not_found", "Workspace not found");
  return role;
}

/** Only the owner manages members, and only in team workspaces (personal ones share documents instead). */
function requireOwner(userId: string, workspaceId: string) {
  if (memberRole(userId, workspaceId) !== "owner") throw new HttpError(403, "forbidden", "Only the workspace owner can do that");
  const { kind } = db.prepare("SELECT kind FROM workspaces WHERE id = ?").get(workspaceId) as { kind: string };
  if (kind !== "team") throw new HttpError(400, "invalid_input", "Personal workspaces can't have members. Share documents instead.");
}

const membersStmt = db.prepare(
  `SELECT u.id AS userId, u.name, u.email, u.color, m.role FROM workspace_members m
   JOIN users u ON u.id = m.user_id WHERE m.workspace_id = ? ORDER BY m.role = 'owner' DESC, u.name`,
);

workspacesRouter.get("/", (_req, res) => {
  res.json({ workspaces: workspacesFor(currentUser(res).id) });
});

workspacesRouter.post("/", (req, res) => {
  const { name } = workspaceCreateSchema.parse(req.body);
  const me = currentUser(res);
  const id = nanoid();
  db.transaction(() => {
    db.prepare("INSERT INTO workspaces (id, name, kind, owner_id, created_at) VALUES (?, ?, 'team', ?, ?)").run(id, name, me.id, Date.now());
    db.prepare("INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (?, ?, 'owner')").run(id, me.id);
    seedWorkspace({ workspaceId: id, userId: me.id, name, kind: "team" });
  })();
  res.status(201).json({ id, name, kind: "team", role: "owner" } satisfies Workspace);
});

workspacesRouter.get("/:id/members", (req, res) => {
  memberRole(currentUser(res).id, req.params.id);
  res.json({ members: membersStmt.all(req.params.id) as Member[] });
});

workspacesRouter.post("/:id/members", (req, res) => {
  const { email, role } = memberInviteSchema.parse(req.body);
  requireOwner(currentUser(res).id, req.params.id);
  const user = userByEmail(email);
  if (!user) throw new HttpError(404, "no_account", "There is no SyncScribe account with that email. Ask them to sign up first.");
  if (workspaceRole(user.id, req.params.id) === "owner") throw new HttpError(400, "invalid_input", "They already own this workspace");
  db.prepare(
    "INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (?, ?, ?) ON CONFLICT DO UPDATE SET role = excluded.role",
  ).run(req.params.id, user.id, role);
  closeConnectionsFor(user.id);
  res.status(201).json({ userId: user.id, name: user.name, email: user.email, color: user.color, role } satisfies Member);
});

/** A member other than the owner; 404 otherwise. */
function memberToChange(workspaceId: string, userId: string): Role {
  const role = workspaceRole(userId, workspaceId);
  if (role === "none") throw new HttpError(404, "not_found", "Member not found");
  if (role === "owner") throw new HttpError(400, "invalid_input", "The owner's access can't be changed");
  return role;
}

workspacesRouter.patch("/:id/members/:userId", (req, res) => {
  const { role } = roleUpdateSchema.parse(req.body);
  requireOwner(currentUser(res).id, req.params.id);
  memberToChange(req.params.id, req.params.userId);
  db.prepare("UPDATE workspace_members SET role = ? WHERE workspace_id = ? AND user_id = ?").run(role, req.params.id, req.params.userId);
  closeConnectionsFor(req.params.userId);
  res.json({ role });
});

workspacesRouter.delete("/:id/members/:userId", (req, res) => {
  requireOwner(currentUser(res).id, req.params.id);
  memberToChange(req.params.id, req.params.userId);
  db.prepare("DELETE FROM workspace_members WHERE workspace_id = ? AND user_id = ?").run(req.params.id, req.params.userId);
  closeConnectionsFor(req.params.userId);
  res.status(204).end();
});
