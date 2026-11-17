import { Router } from "express";
import { can, docDoc, versionNameSchema, type Capability, type Version } from "@syncscribe/shared";
import { db } from "../db/db";
import { HttpError } from "../errors";
import { currentUser, requireAuth } from "../auth/middleware";
import { roleFor } from "../permissions/resolve";
import { deleteDocs } from "../purge";
import { hocuspocus } from "../collab/hocuspocus";
import { saveVersion } from "../collab/versions";

// Permanent delete (BP-5.4, B10) and version history. Moving to Trash and restoring are CRDT changes in the ws: tree.

export const docsRouter = Router();
docsRouter.use(requireAuth);

const subtree = db.prepare(`
  WITH RECURSIVE tree(id) AS (SELECT ? UNION SELECT d.id FROM documents d JOIN tree ON d.parent_id = tree.id)
  SELECT id FROM tree`);

/** Owner only: removes a doc (or a folder and everything in it) with its comments, versions, shares and links. */
docsRouter.delete("/:id", (req, res) => {
  const role = roleFor(currentUser(res).id, docDoc(req.params.id));
  if (role === null || role === "none") throw new HttpError(404, "not_found", "Document not found");
  if (!can(role, "purge")) throw new HttpError(403, "forbidden", "Only the owner can delete this permanently");

  deleteDocs((subtree.all(req.params.id) as { id: string }[]).map((r) => r.id));
  res.status(204).end();
});

// Version history (BP-5.5, H1, H4). Restoring is a new CRDT change made on the client (H3).

/** The caller must be able to do `capability` on the doc; 404 if they can't see it. */
function requireDoc(userId: string, docId: string, capability: Capability) {
  const role = roleFor(userId, docDoc(docId));
  if (role === null || role === "none") throw new HttpError(404, "not_found", "Document not found");
  if (!can(role, capability)) throw new HttpError(403, "forbidden", "You can't change this document's history");
}

interface VersionRow {
  id: string;
  doc_id: string;
  name: string | null;
  authors: string;
  created_at: number;
}
const nameOf = db.prepare("SELECT name FROM users WHERE id = ?");
const toVersion = (r: VersionRow): Version => ({
  id: r.id,
  docId: r.doc_id,
  name: r.name,
  authors: (JSON.parse(r.authors) as string[]).map((id) => (nameOf.get(id) as { name: string } | undefined)?.name ?? "Someone"),
  createdAt: r.created_at,
});
const versionById = (vid: string) => {
  const row = db.prepare("SELECT * FROM versions WHERE id = ?").get(vid) as (VersionRow & { state: Buffer }) | undefined;
  if (!row) throw new HttpError(404, "not_found", "Version not found");
  return row;
};

docsRouter.get("/:id/versions", (req, res) => {
  requireDoc(currentUser(res).id, req.params.id, "read");
  const rows = db.prepare("SELECT id, doc_id, name, authors, created_at FROM versions WHERE doc_id = ? ORDER BY created_at DESC").all(req.params.id);
  res.json({ versions: (rows as VersionRow[]).map(toVersion) });
});

// A named version of the document as it is right now, including edits not yet stored (H4)
docsRouter.post("/:id/versions", async (req, res) => {
  const { name } = versionNameSchema.parse(req.body);
  const me = currentUser(res);
  requireDoc(me.id, req.params.id, "writeDoc");
  const conn = await hocuspocus.openDirectConnection(docDoc(req.params.id));
  const vid = saveVersion(req.params.id, conn.document!, [me.id], name);
  await conn.disconnect();
  res.status(201).json(toVersion(versionById(vid)));
});

export const versionsRouter = Router();
versionsRouter.use(requireAuth);

versionsRouter.get("/:vid", (req, res) => {
  const v = versionById(req.params.vid);
  requireDoc(currentUser(res).id, v.doc_id, "read");
  res.type("application/octet-stream").send(v.state);
});

versionsRouter.patch("/:vid", (req, res) => {
  const { name } = versionNameSchema.parse(req.body);
  const v = versionById(req.params.vid);
  requireDoc(currentUser(res).id, v.doc_id, "writeDoc");
  db.prepare("UPDATE versions SET name = ? WHERE id = ?").run(name, v.id);
  res.json(toVersion({ ...v, name }));
});
