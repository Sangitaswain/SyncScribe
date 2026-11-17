import { Router } from "express";
import { nanoid } from "nanoid";
import { can, docDoc, roleUpdateSchema, shareCreateSchema, type Capability, type Share } from "@syncscribe/shared";
import { db } from "../db/db";
import { config } from "../config";
import { HttpError } from "../errors";
import { currentUser, requireAuth } from "../auth/middleware";
import { roleFor } from "../permissions/resolve";
import { userByEmail } from "../users";
import { sendMail } from "../mail/mailer";
import { closeConnectionsFor } from "../collab/access";

// Sharing a document or folder with people (BP-5.3; G1, G2, G4, EC22)

export const sharesRouter = Router();
sharesRouter.use(requireAuth);

/** The caller must be able to do `capability` on the doc or folder; 404 if they can't see it at all. */
function requireRole(userId: string, resourceId: string, capability: Capability) {
  const role = roleFor(userId, docDoc(resourceId)) ?? "none";
  if (role === "none") throw new HttpError(404, "not_found", "Document not found");
  if (!can(role, capability)) throw new HttpError(403, "forbidden", "You don't have permission to do that");
}

const SELECT = `SELECT s.id, s.resource_id AS resourceId, s.user_id AS userId, COALESCE(u.email, s.invited_email) AS email,
  u.name, s.role FROM shares s LEFT JOIN users u ON u.id = s.user_id`;
const listStmt = db.prepare(`${SELECT} WHERE s.resource_id = ? ORDER BY s.created_at`);
const byIdStmt = db.prepare(`${SELECT} WHERE s.id = ?`);
const shareById = (id: string) => {
  const share = byIdStmt.get(id) as Share | undefined;
  if (!share) throw new HttpError(404, "not_found", "Share not found");
  return share;
};

sharesRouter.get("/", (req, res) => {
  const resourceId = String(req.query.resource ?? "");
  requireRole(currentUser(res).id, resourceId, "invite"); // owners and editors see who has access
  res.json({ shares: listStmt.all(resourceId) });
});

// Editors may invite up to editor, owners anyone; share roles never go above editor (BP-4.2)
sharesRouter.post("/", async (req, res) => {
  const { resourceId, email, role } = shareCreateSchema.parse(req.body);
  const me = currentUser(res);
  requireRole(me.id, resourceId, "invite");
  const user = userByEmail(email);
  if (user?.id === me.id) throw new HttpError(400, "invalid_input", "You already have access");

  const values = { id: nanoid(), resourceId, userId: user?.id ?? null, email: user ? null : email, role, by: me.id, now: Date.now() };
  db.prepare(
    `INSERT INTO shares (id, resource_id, user_id, invited_email, role, created_by, created_at)
     VALUES (@id, @resourceId, @userId, @email, @role, @by, @now)
     ON CONFLICT DO UPDATE SET role = excluded.role`,
  ).run(values);
  const share = (
    user
      ? db.prepare(`${SELECT} WHERE s.resource_id = ? AND s.user_id = ?`).get(resourceId, user.id)
      : db.prepare(`${SELECT} WHERE s.resource_id = ? AND s.invited_email = ?`).get(resourceId, email)
  ) as Share;

  if (user) closeConnectionsFor(user.id); // a re-invite may change their role
  // No account yet: the share waits for them and is attached when they sign up (EC22)
  else
    await sendMail({
      to: email,
      subject: `${me.name} shared a document with you on SyncScribe`,
      text: `${me.name} invited you to a document on SyncScribe.\n\nCreate an account with this email address to open it: ${config.APP_URL}/signup`,
    });
  res.status(201).json(share);
});

// Changing or removing access is for owners only; the person's open connections are refreshed (EC16, EC17)
sharesRouter.patch("/:id", (req, res) => {
  const { role } = roleUpdateSchema.parse(req.body);
  const share = shareById(req.params.id);
  requireRole(currentUser(res).id, share.resourceId, "manageAccess");
  db.prepare("UPDATE shares SET role = ? WHERE id = ?").run(role, share.id);
  if (share.userId) closeConnectionsFor(share.userId);
  res.json(shareById(share.id));
});

sharesRouter.delete("/:id", (req, res) => {
  const share = shareById(req.params.id);
  requireRole(currentUser(res).id, share.resourceId, "manageAccess");
  db.prepare("DELETE FROM shares WHERE id = ?").run(share.id);
  if (share.userId) closeConnectionsFor(share.userId);
  res.status(204).end();
});
