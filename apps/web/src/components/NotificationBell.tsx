import { useState } from "react";
import { useNavigate } from "react-router";
import { Bell } from "lucide-react";
import type { AppNotification } from "@syncscribe/shared";
import { unreadCount, useNotifications } from "../stores/notifications";
import { markRead } from "../services/notifications";

const ROLE: Record<string, string> = { editor: "Editor", commenter: "Commenter", viewer: "Viewer" };

/** Plain-language text and, if there is one, the document a notification is about. */
export function describe(n: AppNotification): { text: string; docId?: string } {
  const p = n.payload as { title?: string; by?: string; role?: string; resourceId?: string; docId?: string };
  const title = `"${p.title || "Untitled"}"`;
  switch (n.type) {
    case "shared":
      return { text: `${p.by ?? "Someone"} shared ${title} with you`, docId: p.resourceId };
    case "role_changed":
      return { text: `You are now ${ROLE[p.role ?? ""] ?? "a collaborator"} on ${title}`, docId: p.resourceId };
    case "access_removed":
      return { text: `Your access to ${title} was removed` };
    case "mentioned":
      return { text: `${p.by ?? "Someone"} mentioned you in ${title}`, docId: p.docId };
  }
}

/** Unread count and the list of notifications (J3). */
export default function NotificationBell() {
  const items = useNotifications((s) => s.items);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const unread = unreadCount(items);

  return (
    <div className="relative" onMouseLeave={() => setOpen(false)} onKeyDown={(e) => e.key === "Escape" && setOpen(false)}>
      <button
        onClick={() => setOpen(!open)}
        aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
        title="Notifications"
        aria-expanded={open}
        className="relative rounded-md p-1.5 text-muted hover:bg-hover hover:text-ink dark:hover:bg-white/5 dark:hover:text-white"
      >
        <Bell className="size-4" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-semibold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute top-full right-0 z-40 w-80 rounded-lg border border-line bg-white py-1 shadow-lg dark:border-white/10 dark:bg-[#222]">
          <div className="flex items-center justify-between px-3 py-1.5">
            <span className="text-sm font-medium">Notifications</span>
            {unread > 0 && (
              <button onClick={() => markRead(items.filter((n) => !n.readAt).map((n) => n.id))} className="text-xs text-brand hover:underline">
                Mark all as read
              </button>
            )}
          </div>
          {!items.length && <p className="px-3 py-4 text-center text-sm text-muted">No notifications yet.</p>}
          <ul className="max-h-80 overflow-y-auto">
            {items.map((n) => {
              const { text, docId } = describe(n);
              return (
                <li key={n.id}>
                  <button
                    onClick={() => {
                      markRead([n.id]);
                      setOpen(false);
                      if (docId) navigate(`/doc/${docId}`);
                    }}
                    className={`flex w-full gap-2 px-3 py-2 text-left text-sm hover:bg-hover dark:hover:bg-white/5 ${n.readAt ? "text-muted" : ""}`}
                  >
                    <span className={`mt-1.5 size-1.5 shrink-0 rounded-full ${n.readAt ? "" : "bg-brand"}`} />
                    <span className="min-w-0 flex-1">
                      {text}
                      <span className="block text-xs text-muted">{new Date(n.createdAt).toLocaleString()}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
