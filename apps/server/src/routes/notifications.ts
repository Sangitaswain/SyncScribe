import { Router } from "express";
import { docDoc, mentionSchema, notificationsReadSchema, type AppNotification } from "@syncscribe/shared";
import { db } from "../db/db";
import { HttpError } from "../errors";
import { currentUser, requireAuth } from "../auth/middleware";
import { roleFor } from "../permissions/resolve";
import { notify, titleOf } from "../collab/notify";

// My notifications and @mentions (BP-5.6, J3, F5)

export const notificationsRouter = Router();
notificationsRouter.use(requireAuth);

interface Row {
  id: string;
  type: AppNotification["type"];
  payload: string;
  read_at: number | null;
  created_at: number;
}

notificationsRouter.get("/notifications", (req, res) => {
  const unread = req.query.unread === "1" ? "AND read_at IS NULL" : "";
  const rows = db
    .prepare(`SELECT * FROM notifications WHERE user_id = ? ${unread} ORDER BY created_at DESC LIMIT 100`)
    .all(currentUser(res).id) as Row[];
  const notifications: AppNotification[] = rows.map((r) => ({
    id: r.id,
    type: r.type,
    payload: JSON.parse(r.payload),
    readAt: r.read_at,
    createdAt: r.created_at,
  }));
  res.json({ notifications });
});

notificationsRouter.post("/notifications/read", (req, res) => {
  const { ids } = notificationsReadSchema.parse(req.body);
  const mark = db.prepare("UPDATE notifications SET read_at = ? WHERE id = ? AND user_id = ? AND read_at IS NULL");
  const now = Date.now();
  db.transaction(() => ids.forEach((id) => mark.run(now, id, currentUser(res).id)))();
  res.status(204).end();
});

// Sent from the client's outbox, so mentions written offline arrive later (F5)
notificationsRouter.post("/mentions", (req, res) => {
  const { docId, threadId, userIds } = mentionSchema.parse(req.body);
  const me = currentUser(res);
  const myRole = roleFor(me.id, docDoc(docId));
  if (!myRole || myRole === "none") throw new HttpError(404, "not_found", "Document not found");
  // Only people who can read the document are told about it
  const notified = [...new Set(userIds)].filter((id) => {
    const role = id !== me.id && roleFor(id, docDoc(docId));
    return role && role !== "none";
  });
  for (const id of notified) notify(id, "mentioned", { docId, threadId, title: titleOf(docId), by: me.name });
  res.json({ notified: notified.length });
});
