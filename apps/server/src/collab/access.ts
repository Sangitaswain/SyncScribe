import { hocuspocus } from "./hocuspocus";
import type { CollabContext } from "./auth";

/**
 * After a share or membership changes, disconnects the user's open workspace trees, docs and comments;
 * their client reconnects and signs in again with the new role: read-only, refused, or upgraded (EC16, EC17).
 */
// ponytail: closes all the user's connections, not only the affected ones; reconnecting is cheap
export function closeConnectionsFor(userId: string) {
  for (const doc of hocuspocus.documents.values()) {
    if (!/^(ws|doc|cm):/.test(doc.name)) continue;
    for (const conn of doc.getConnections()) {
      if ((conn.context as CollabContext).user.id !== userId) continue;
      conn.sendStateless(JSON.stringify({ type: "role-changed" }));
      conn.close({ code: 1000, reason: "role-changed" });
    }
  }
}
