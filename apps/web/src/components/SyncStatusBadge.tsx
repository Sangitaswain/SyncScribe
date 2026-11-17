import { Cloud, CloudAlert, CloudCheck, CloudOff, LoaderCircle, RefreshCw } from "lucide-react";
import { useNetwork } from "../stores/network";
import { syncNow } from "../sync/network";

const LOOK = {
  online: { label: "Online", Icon: Cloud, color: "text-muted" },
  offline: { label: "Offline", Icon: CloudOff, color: "text-muted" },
  syncing: { label: "Syncing", Icon: LoaderCircle, color: "text-brand" },
  synced: { label: "Synced", Icon: CloudCheck, color: "text-emerald-600" },
  error: { label: "Sync error", Icon: CloudAlert, color: "text-rose-600" },
};

/** Global sync state, unsynced document count and Sync now / Retry (E5, E6, E7, EC39). */
export default function SyncStatusBadge() {
  const state = useNetwork((s) => s.syncState);
  const pending = useNetwork((s) => s.pendingCount);
  const reason = useNetwork((s) => s.errorReason);
  const browserOnline = useNetwork((s) => s.browserOnline);
  const { label, Icon, color } = LOOK[state];
  const error = state === "error";

  return (
    <div className="flex items-center gap-1 text-xs">
      <span role="status" title={reason ?? label} className={`flex items-center gap-1.5 px-1 ${color}`}>
        <Icon className={`size-4 ${state === "syncing" ? "animate-spin" : ""}`} />
        <span className={error ? "" : "hidden sm:inline"}>{label}</span>
        {pending > 0 && (
          <span className="text-muted">
            · {pending}
            <span className="hidden sm:inline"> unsynced</span>
          </span>
        )}
      </span>
      <button
        onClick={syncNow}
        disabled={!browserOnline}
        aria-label={error ? "Retry" : "Sync now"}
        title={error ? "Retry" : "Sync now"}
        className="flex items-center gap-1 rounded-md p-1.5 text-muted hover:bg-hover hover:text-ink disabled:opacity-40 dark:hover:bg-white/5 dark:hover:text-white"
      >
        <RefreshCw className="size-3.5" />
        {error && <span>Retry</span>}
      </button>
    </div>
  );
}
