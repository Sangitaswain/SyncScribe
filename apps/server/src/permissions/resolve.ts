import { maxRole, parseDocName, type Role } from "@syncscribe/shared";
import { db } from "../db/db";

// Who may open which Yjs document (BP-4.2). Shares are added in Step 13.

const workspaceRole = (userId: string, workspaceId: string) =>
  ((db.prepare("SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?").get(workspaceId, userId) as
    | { role: Role }
    | undefined)?.role ?? "none") as Role;

export const docRow = (id: string) =>
  db.prepare("SELECT workspace_id, owner_id, parent_id FROM documents WHERE id = ?").get(id) as
    | { workspace_id: string; owner_id: string; parent_id: string | null }
    | undefined;

/** Role of a user on a document name; null if the doc is not known to the server yet. */
export function roleFor(userId: string, name: string): Role | null {
  const parsed = parseDocName(name);
  if (!parsed) return "none";
  const { kind, id } = parsed;
  if (kind === "user") return id === userId ? "owner" : "none";
  if (kind === "ws") return workspaceRole(userId, id);
  const row = docRow(id);
  if (!row) return null;
  return maxRole(row.owner_id === userId ? "owner" : "none", workspaceRole(userId, row.workspace_id));
}
