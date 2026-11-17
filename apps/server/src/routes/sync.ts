import { Router } from "express";
import { db } from "../db/db";
import { currentUser, requireAuth } from "../auth/middleware";
import { HttpError } from "../errors";

export const syncRouter = Router();
syncRouter.use(requireAuth);

// Stored docs the user can access: own prefs, member workspaces, and the docs/comments inside them (BP-5.7).
// Shared documents are added in Step 13.
const accessible = db.prepare(`
  SELECT s.name FROM ydoc_state s
  WHERE s.updated_at > @since AND (
    s.name = 'user:' || @uid
    OR s.name IN (SELECT 'ws:' || workspace_id FROM workspace_members WHERE user_id = @uid)
    OR s.name IN (SELECT p.prefix || d.id FROM documents d
                  JOIN workspace_members m ON m.workspace_id = d.workspace_id AND m.user_id = @uid
                  JOIN (SELECT 'doc:' AS prefix UNION ALL SELECT 'cm:') p
                  WHERE d.type = 'doc')
  )
  ORDER BY s.name`);

const list = (uid: string, since: number) => ({
  names: (accessible.all({ uid, since }) as { name: string }[]).map((r) => r.name),
  now: Date.now(),
});

/** Every document name the user can access (new device bootstrap, DF13). */
syncRouter.get("/all", (_req, res) => {
  res.json(list(currentUser(res).id, -1));
});

/** Documents changed on the server since `since` (ms); use the returned `now` next time (E2). */
syncRouter.get("/changed", (req, res) => {
  const since = Number(req.query.since);
  if (!Number.isFinite(since)) throw new HttpError(400, "invalid_input", "since must be a timestamp in ms");
  res.json(list(currentUser(res).id, since));
});
