import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Copy, X } from "lucide-react";
import { can, shareCreateSchema, type Role, type Share, type ShareLink, type ShareRole } from "@syncscribe/shared";
import { useUi } from "../stores/ui";
import { useNetwork } from "../stores/network";
import { api } from "../services/api";
import { sendOrQueue } from "../services/outbox";
import { inputClass, primaryButton } from "./ui";

const ROLES: { role: ShareRole; label: string }[] = [
  { role: "editor", label: "Editor" },
  { role: "commenter", label: "Commenter" },
  { role: "viewer", label: "Viewer" },
];

export function RoleSelect({ value, onChange, name }: { value?: ShareRole; onChange?: (r: ShareRole) => void; name?: string }) {
  return (
    <div className="w-32 shrink-0">
      <select name={name} value={value} defaultValue={value ? undefined : "editor"} onChange={(e) => onChange?.(e.target.value as ShareRole)} className={inputClass} aria-label="Role">
        {ROLES.map((r) => (
          <option key={r.role} value={r.role}>
            {r.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Opened with `useUi.modal = "share:<docOrFolderId>"`. */
export default function ShareDialog() {
  const modal = useUi((s) => s.modal);
  const resourceId = modal?.startsWith("share:") ? modal.slice(6) : null;
  return resourceId ? <Dialog key={resourceId} resourceId={resourceId} /> : null;
}

/** Invite people, share links and manage access (G1–G4); controls follow the caller's role. */
function Dialog({ resourceId }: { resourceId: string }) {
  const online = useNetwork((s) => s.serverReachable);
  const [access, setAccess] = useState<{ role: Role; shares: Share[] } | null>(null);
  const [links, setLinks] = useState<ShareLink[]>([]);
  const [newLink, setNewLink] = useState("");
  const [message, setMessage] = useState("");
  const close = () => useUi.setState({ modal: null });

  const load = useCallback(async () => {
    try {
      const data = await api<{ role: Role; shares: Share[] }>(`/shares?resource=${resourceId}`);
      setAccess(data);
      if (can(data.role, "manageAccess")) setLinks((await api<{ links: ShareLink[] }>(`/share-links?resource=${resourceId}`)).links);
    } catch (e) {
      setMessage((e as Error).message);
    }
  }, [resourceId]);
  useEffect(() => {
    if (online) load();
  }, [online, load]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Offline the role isn't known yet: allow the invite and let the server decide when it is sent
  const canInvite = !access || can(access.role, "invite");
  const isOwner = !!access && can(access.role, "manageAccess");
  const act = (fn: () => Promise<unknown>) => () =>
    fn()
      .then(load)
      .catch((e) => setMessage((e as Error).message));

  async function invite(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const parsed = shareCreateSchema.safeParse({ resourceId, ...Object.fromEntries(new FormData(form)) });
    if (!parsed.success) return setMessage("Please enter a valid email");
    try {
      const sent = await sendOrQueue(`Invite to ${parsed.data.email}`, "POST", "/shares", parsed.data);
      setMessage(sent ? `Invited ${parsed.data.email}` : "Invitation will be sent when you're back online");
      form.reset();
      if (sent) load();
    } catch (err) {
      setMessage((err as Error).message);
    }
  }

  async function createLink(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const role = new FormData(e.currentTarget).get("role");
    try {
      const link = await api<ShareLink>("/share-links", { body: { resourceId, role } });
      setNewLink(link.url ?? "");
      load();
    } catch (err) {
      setMessage((err as Error).message);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={close}>
      <div
        role="dialog"
        aria-label="Share"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-full w-full max-w-md flex-col gap-4 overflow-auto rounded-2xl bg-white p-6 shadow-xl dark:bg-[#1c1c1c]"
      >
        <div className="flex items-center">
          <h2 className="flex-1 text-lg font-semibold">Share</h2>
          <button onClick={close} aria-label="Close" className="rounded-md p-1 text-muted hover:bg-hover hover:text-ink dark:hover:bg-white/5">
            <X className="size-4" />
          </button>
        </div>

        {canInvite && (
          <form onSubmit={invite} className="flex gap-2">
            <input name="email" type="email" placeholder="Email address" aria-label="Email address" className={inputClass} />
            <RoleSelect name="role" />
            <button className={primaryButton}>Invite</button>
          </form>
        )}
        {message && <p className="text-sm text-muted" role="status">{message}</p>}
        {!online && <p className="text-sm text-muted">You're offline. Who has access shows here when you reconnect.</p>}

        {access && (
          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-medium">People with access</h3>
            {!access.shares.length && <p className="text-sm text-muted">Only you and your workspace for now.</p>}
            {access.shares.map((s) => (
              <div key={s.id} className="flex items-center gap-2 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="truncate">{s.name ?? s.email}</div>
                  {s.name && <div className="truncate text-xs text-muted">{s.email}</div>}
                  {!s.userId && <div className="text-xs text-muted">Invited, no account yet</div>}
                </div>
                {isOwner ? (
                  <>
                    <RoleSelect value={s.role} onChange={(role) => act(() => api(`/shares/${s.id}`, { method: "PATCH", body: { role } }))()} />
                    <button onClick={act(() => api(`/shares/${s.id}`, { method: "DELETE" }))} className="text-xs text-rose-600 hover:underline">
                      Remove
                    </button>
                  </>
                ) : (
                  <span className="text-muted">{ROLES.find((r) => r.role === s.role)?.label}</span>
                )}
              </div>
            ))}
          </section>
        )}

        {isOwner && (
          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-medium">Share link</h3>
            <form onSubmit={createLink} className="flex gap-2">
              <p className="flex-1 self-center text-sm text-muted">Anyone signed in with the link gets</p>
              <RoleSelect name="role" />
              <button className={primaryButton}>Create</button>
            </form>
            {newLink && (
              <div className="flex items-center gap-2">
                <input value={newLink} readOnly aria-label="Share link" className={inputClass} />
                <button
                  onClick={() => navigator.clipboard?.writeText(newLink).then(() => setMessage("Link copied"))}
                  aria-label="Copy link"
                  className="rounded-md p-2 text-muted hover:bg-hover hover:text-ink dark:hover:bg-white/5"
                >
                  <Copy className="size-4" />
                </button>
              </div>
            )}
            {links.map((l) => (
              <div key={l.id} className="flex items-center gap-2 text-sm">
                <span className="flex-1 text-muted">Link for {ROLES.find((r) => r.role === l.role)?.label.toLowerCase()}s</span>
                <button
                  onClick={act(async () => {
                    await api(`/share-links/${l.id}`, { method: "DELETE" });
                    setNewLink("");
                  })}
                  className="text-xs text-rose-600 hover:underline"
                >
                  Revoke
                </button>
              </div>
            ))}
          </section>
        )}
      </div>
    </div>
  );
}
