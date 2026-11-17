import { usePresence } from "../stores/presence";
import { useSession } from "../stores/session";
import { useNetwork } from "../stores/network";

/** Who has the open document right now (F2); my own avatar fades while I'm offline (4.6 step 5). */
export default function PresenceAvatars() {
  const users = usePresence((s) => s.users);
  const me = useSession((s) => s.user?.id);
  const offline = useNetwork((s) => s.syncState === "offline");
  if (!users.length) return null;

  const sorted = [...users].sort((a, b) => Number(b.id === me) - Number(a.id === me)); // me first
  return (
    <div className="flex -space-x-1" aria-label="People in this document">
      {sorted.map((u) => {
        const away = u.id === me && offline;
        return (
          <span
            key={u.id}
            title={away ? `${u.name} (offline)` : u.name}
            className={`flex size-6 items-center justify-center rounded-full text-[10px] font-semibold text-white ring-2 ring-white dark:ring-[#141414] ${away ? "opacity-40" : ""}`}
            style={{ backgroundColor: u.color }}
          >
            {u.name.slice(0, 1).toUpperCase()}
          </span>
        );
      })}
    </div>
  );
}
