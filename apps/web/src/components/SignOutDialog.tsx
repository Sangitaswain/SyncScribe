import { useState } from "react";
import { useUi } from "../stores/ui";
import { useNetwork } from "../stores/network";
import { useDocTitle } from "../crdt/titles";
import { pendingNames } from "../services/pending";
import { clearDevice, clearSession } from "../services/session";
import { stopSync } from "../sync/providers";
import { syncNow } from "../sync/network";
import { primaryButton } from "./ui";

const secondary = "rounded-lg px-4 py-2 text-sm text-ink hover:bg-hover dark:text-white dark:hover:bg-white/5";

function PendingDoc({ id }: { id: string }) {
  return <li className="truncate">{useDocTitle(id) || "Untitled"}</li>;
}

/** Opened with `useUi.modal = "signout"`. Warns about unsynced changes before signing out (A2, EC20, EC21). */
export default function SignOutDialog() {
  const open = useUi((s) => s.modal === "signout");
  const pending = useNetwork((s) => s.pendingCount);
  const online = useNetwork((s) => s.serverReachable);
  const [syncing, setSyncing] = useState(false);
  if (!open) return null;

  const close = () => {
    setSyncing(false);
    useUi.setState({ modal: null });
  };
  const signOut = () => {
    close();
    return clearSession(); // docs stay on this device for next time
  };
  const clear = async () => {
    close();
    await stopSync(); // close every doc so its database can be deleted
    await clearDevice();
  };
  const syncFirst = () => {
    setSyncing(true);
    syncNow();
    const stop = useNetwork.subscribe((s) => {
      if (s.pendingCount || !useUi.getState().modal) return;
      stop();
      if (useUi.getState().modal === "signout") signOut();
    });
  };

  const docs = pendingNames().filter((n) => n.startsWith("doc:"));
  const others = pending - docs.length;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={close}>
      <div
        role="dialog"
        aria-label="Sign out"
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-sm flex-col gap-3 rounded-2xl bg-white p-6 shadow-xl dark:bg-[#1c1c1c]"
      >
        <h2 className="text-lg font-semibold">Sign out?</h2>
        {pending > 0 ? (
          <>
            <p className="text-sm text-muted">These changes haven't synced yet. They are safe on this device unless you clear it.</p>
            <ul className="list-inside list-disc text-sm">
              {docs.map((n) => (
                <PendingDoc key={n} id={n.slice(4)} />
              ))}
              {others > 0 && <li>Folder and settings changes</li>}
            </ul>
            {!online && <p className="text-sm text-muted">You're offline, so they can't sync right now.</p>}
            <button onClick={syncFirst} disabled={!online || syncing} className={primaryButton}>
              {syncing ? "Syncing…" : "Sync first, then sign out"}
            </button>
            <button onClick={signOut} className={secondary}>
              Sign out and keep data on this device
            </button>
          </>
        ) : (
          <>
            <p className="text-sm text-muted">Everything is synced. Your documents stay on this device for next time.</p>
            <button onClick={signOut} className={primaryButton}>
              Sign out
            </button>
          </>
        )}
        <button onClick={clear} className="rounded-lg px-4 py-2 text-sm text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10">
          {pending > 0 ? "Sign out and clear this device (unsynced changes are lost)" : "Sign out and clear this device"}
        </button>
        <button onClick={close} className={secondary}>
          Cancel
        </button>
      </div>
    </div>
  );
}
