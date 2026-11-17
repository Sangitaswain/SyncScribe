import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { Check, ChevronsUpDown, Plus, Users } from "lucide-react";
import { workspaceCreateSchema, type AuthResponse } from "@syncscribe/shared";
import { useSession } from "../stores/session";
import { useNetwork } from "../stores/network";
import { toast } from "../stores/ui";
import { api } from "../services/api";
import { saveSession } from "../services/session";
import { inputClass, rowClass } from "./ui";

/** Switch between my workspaces, open members, or create a team workspace (B2). */
export default function WorkspaceSwitcher() {
  const { workspaces, activeWorkspaceId } = useSession();
  const online = useNetwork((s) => s.serverReachable);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();
  const ws = workspaces.find((w) => w.id === activeWorkspaceId);
  const go = (path: string) => {
    setOpen(false);
    navigate(path);
  };

  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const parsed = workspaceCreateSchema.safeParse(Object.fromEntries(new FormData(e.currentTarget)));
    if (!parsed.success) return toast("Please enter a workspace name", "error");
    try {
      const { id } = await api<{ id: string }>("/workspaces", { body: parsed.data });
      await saveSession(await api<AuthResponse>("/me")); // new token and workspace list, kept for offline start
      useSession.setState({ activeWorkspaceId: id });
      setCreating(false);
      go("/");
    } catch (err) {
      toast((err as Error).message, "error");
    }
  }

  return (
    <div className="relative min-w-0 flex-1" onMouseLeave={() => setOpen(false)}>
      <button onClick={() => setOpen(!open)} className={`${rowClass()} h-10 w-full`} title="Workspace" aria-expanded={open}>
        <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-brand text-xs font-semibold text-white">
          {(ws?.name ?? "W").slice(0, 1).toUpperCase()}
        </span>
        <span className="truncate font-medium">{ws?.name ?? "Workspace"}</span>
        <ChevronsUpDown className="ml-auto size-3.5 shrink-0 text-muted" />
      </button>
      {open && (
        <div className="absolute top-full right-0 left-0 z-40 rounded-lg border border-line bg-white p-1 shadow-lg dark:border-white/10 dark:bg-[#222]">
          {workspaces.map((w) => (
            <button
              key={w.id}
              className={`${rowClass(w.id === activeWorkspaceId)} w-full`}
              onClick={() => {
                useSession.setState({ activeWorkspaceId: w.id });
                go("/");
              }}
            >
              <span className="flex-1 truncate text-left">{w.name}</span>
              {w.id === activeWorkspaceId && <Check className="size-3.5 text-muted" />}
            </button>
          ))}
          <div className="my-1 border-t border-line dark:border-white/10" />
          {ws?.kind === "team" && (
            <button className={`${rowClass()} w-full`} onClick={() => go(`/workspaces/${ws.id}/members`)}>
              <Users className="size-4 text-muted" /> Members
            </button>
          )}
          {creating ? (
            <form onSubmit={create} className="p-1">
              <input name="name" autoFocus placeholder="Workspace name" aria-label="Workspace name" className={inputClass} />
            </form>
          ) : (
            <button
              className={`${rowClass()} w-full`}
              onClick={() => (online ? setCreating(true) : toast("Connect to the internet to create a workspace"))}
            >
              <Plus className="size-4 text-muted" /> New team workspace
            </button>
          )}
        </div>
      )}
    </div>
  );
}
