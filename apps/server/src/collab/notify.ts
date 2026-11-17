import { nanoid } from "nanoid";
import { userDoc, type AppNotification, type NotificationType } from "@syncscribe/shared";
import { db } from "../db/db";
import { hocuspocus } from "./hocuspocus";

// Notifications (BP-5.6, J3): stored for later, and delivered live if the person is connected

const insert = db.prepare("INSERT INTO notifications (id, user_id, type, payload, created_at) VALUES (?, ?, ?, ?, ?)");

/** Cached title of a doc or folder, for notification text. */
export const titleOf = (id: string) =>
  ((db.prepare("SELECT title FROM documents WHERE id = ?").get(id) as { title: string } | undefined)?.title || "Untitled");

export function notify(userId: string, type: NotificationType, payload: Record<string, unknown>) {
  const notification: AppNotification = { id: nanoid(), type, payload, readAt: null, createdAt: Date.now() };
  insert.run(notification.id, userId, type, JSON.stringify(payload), notification.createdAt);
  // Live: a stateless message on the person's always-open user:{id} connection
  for (const conn of hocuspocus.documents.get(userDoc(userId))?.getConnections() ?? [])
    conn.sendStateless(JSON.stringify({ type: "notification", notification }));
  return notification;
}
