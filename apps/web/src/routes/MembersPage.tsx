import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useParams } from "react-router";
import { memberInviteSchema, type Member } from "@syncscribe/shared";
import { api } from "../services/api";
import { sendOrQueue } from "../services/outbox";
import { useSession } from "../stores/session";
import { useNetwork } from "../stores/network";
import { RoleSelect } from "../components/ShareDialog";
import { inputClass, primaryButton } from "../components/ui";

const LABEL = { owner: "Owner", editor: "Editor", commenter: "Commenter", viewer: "Viewer", none: "" };

/** Members of a team workspace; the owner invites, changes roles and removes people (B2). */
export default function MembersPage() {
  const { id = "" } = useParams();
  const me = useSession((s) => s.user?.id);
  const ws = useSession((s) => s.workspaces.find((w) => w.id === id));
  const online = useNetwork((s) => s.serverReachable);
  const [members, setMembers] = useState<Member[]>([]);
  const [message, setMessage] = useState("");
  const isOwner = ws?.role === "owner" && ws.kind === "team";

  const load = useCallback(
    () =>
      api<{ members: Member[] }>(`/workspaces/${id}/members`)
        .then((r) => setMembers(r.members))
        .catch((e) => setMessage((e as Error).message)),
    [id],
  );
  useEffect(() => {
    if (online) load();
  }, [online, load]);
  const act = (fn: () => Promise<unknown>) => () =>
    fn()
      .then(load)
      .catch((e) => setMessage((e as Error).message));

  async function invite(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const parsed = memberInviteSchema.safeParse(Object.fromEntries(new FormData(form)));
    if (!parsed.success) return setMessage("Please enter a valid email");
    try {
      const sent = await sendOrQueue(`Invite to ${parsed.data.email}`, "POST", `/workspaces/${id}/members`, parsed.data);
      setMessage(sent ? `Added ${parsed.data.email}` : "Invitation will be sent when you're back online");
      form.reset();
      if (sent) load();
    } catch (err) {
      setMessage((err as Error).message);
    }
  }

  return (
    <div className="mx-auto max-w-[800px] px-6 pt-10 pb-16">
      <h1 className="mb-1 text-[32px] font-bold tracking-tight">Members</h1>
      <p className="mb-6 text-sm text-muted">{ws?.name}</p>
      {isOwner && (
        <form onSubmit={invite} className="mb-2 flex gap-2">
          <input name="email" type="email" placeholder="Email address" aria-label="Email address" className={inputClass} />
          <RoleSelect name="role" />
          <button className={primaryButton}>Invite</button>
        </form>
      )}
      {message && <p className="mb-2 text-sm text-muted" role="status">{message}</p>}
      {!online && <p className="mb-2 text-sm text-muted">You're offline. Members show here when you reconnect.</p>}
      {members.map((m) => (
        <div key={m.userId} className="flex items-center gap-3 border-b border-line px-2 py-3 text-sm dark:border-white/10">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white" style={{ backgroundColor: m.color }}>
            {m.name.slice(0, 1).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate">
              {m.name}
              {m.userId === me && <span className="text-muted"> (you)</span>}
            </div>
            <div className="truncate text-xs text-muted">{m.email}</div>
          </div>
          {isOwner && m.role !== "owner" ? (
            <>
              <RoleSelect
                value={m.role as "editor" | "commenter" | "viewer"}
                onChange={(role) => act(() => api(`/workspaces/${id}/members/${m.userId}`, { method: "PATCH", body: { role } }))()}
              />
              <button onClick={act(() => api(`/workspaces/${id}/members/${m.userId}`, { method: "DELETE" }))} className="text-xs text-rose-600 hover:underline">
                Remove
              </button>
            </>
          ) : (
            <span className="text-muted">{LABEL[m.role]}</span>
          )}
        </div>
      ))}
    </div>
  );
}
