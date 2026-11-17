import { Router } from "express";
import { can, cmDoc, docDoc } from "@syncscribe/shared";
import { db } from "../db/db";
import { HttpError } from "../errors";
import { currentUser, requireAuth } from "../auth/middleware";
import { roleFor } from "../permissions/resolve";
import { hocuspocus } from "../collab/hocuspocus";

// Permanent delete (BP-5.4, B10). Moving to Trash and restoring are CRDT changes in the ws: tree.

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

  const ids = (subtree.all(req.params.id) as { id: string }[]).map((r) => r.id);
  for (const id of ids) for (const name of [docDoc(id), cmDoc(id)]) hocuspocus.closeConnections(name);
  db.transaction(() => {
    for (const id of ids) {
      db.prepare("DELETE FROM ydoc_state WHERE name IN (?, ?)").run(docDoc(id), cmDoc(id));
      db.prepare("DELETE FROM versions WHERE doc_id = ?").run(id);
      db.prepare("DELETE FROM shares WHERE resource_id = ?").run(id);
      db.prepare("DELETE FROM share_links WHERE resource_id = ?").run(id);
      db.prepare("DELETE FROM documents WHERE id = ?").run(id);
    }
  })();
  res.status(204).end();
});
