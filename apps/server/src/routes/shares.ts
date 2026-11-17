import { createHash, randomBytes } from "node:crypto";
import { Router } from "express";
import { nanoid } from "nanoid";
import {
  can,
  docDoc,
  rank,
  roleUpdateSchema,
  shareCreateSchema,
  shareLinkCreateSchema,
  type Capability,
  type Share,
  type ShareRole,
} from "@syncscribe/shared";
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

// Share links (G3, EC23): anyone signed in who opens the link gets its role; only a hash of the token is stored

export const shareLinksRouter = Router();
shareLinksRouter.use(requireAuth);

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

shareLinksRouter.post("/", (req, res) => {
  const { resourceId, role } = shareLinkCreateSchema.parse(req.body);
  const me = currentUser(res);
  requireRole(me.id, resourceId, "manageAccess");
  const id = nanoid();
  const token = randomBytes(24).toString("base64url");
  db.prepare(
    "INSERT INTO share_links (id, token_hash, resource_id, role, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?)",
  ).run(id, sha256(token), resourceId, role, me.id, Date.now());
  res.status(201).json({ id, resourceId, role, url: `${config.APP_URL}/s/${token}`, revoked: false });
});

shareLinksRouter.delete("/:id", (req, res) => {
  const link = db.prepare("SELECT resource_id FROM share_links WHERE id = ?").get(req.params.id) as
    | { resource_id: string }
    | undefined;
  if (!link) throw new HttpError(404, "not_found", "Link not found");
  requireRole(currentUser(res).id, link.resource_id, "manageAccess");
  db.prepare("UPDATE share_links SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL").run(Date.now(), req.params.id);
  res.status(204).end();
});

shareLinksRouter.post("/:token/accept", (req, res) => {
  const link = db
    .prepare("SELECT resource_id, role, created_by FROM share_links WHERE token_hash = ? AND revoked_at IS NULL")
    .get(sha256(req.params.token)) as { resource_id: string; role: ShareRole; created_by: string } | undefined;
  if (!link) throw new HttpError(410, "link_inactive", "This link is no longer active");
  const me = currentUser(res);
  // Never lowers access the person already has through another share
  const existing = db.prepare("SELECT role FROM shares WHERE resource_id = ? AND user_id = ?").get(link.resource_id, me.id) as
    | { role: ShareRole }
    | undefined;
  if (!existing || rank(existing.role) < rank(link.role)) {
    db.prepare(
      `INSERT INTO shares (id, resource_id, user_id, role, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT DO UPDATE SET role = excluded.role`,
    ).run(nanoid(), link.resource_id, me.id, link.role, link.created_by, Date.now());
    closeConnectionsFor(me.id);
  }
  res.json({ resourceId: link.resource_id, role: roleFor(me.id, docDoc(link.resource_id)) });
});
