import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useNetwork } from "../stores/network";

/** Non-blocking notice while offline: work is kept and synced later (4.4 step 2, EC3). */
export default function OfflineBanner() {
  const offline = useNetwork((s) => s.syncState === "offline");
  const browserOnline = useNetwork((s) => s.browserOnline);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!offline) setDismissed(false); // show it again the next time the connection drops
  }, [offline]);

  if (!offline || dismissed) return null;
  return (
    <div role="status" className="flex shrink-0 items-center gap-2 bg-panel px-4 py-1.5 text-xs text-muted dark:bg-white/5">
      <span className="min-w-0 flex-1">
        {browserOnline ? "Can't reach SyncScribe — working offline." : "You're offline."} Your changes are saved on this
        device and will sync automatically when you reconnect.
      </span>
      <button
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
        className="rounded-md p-0.5 hover:bg-hover hover:text-ink dark:hover:bg-white/5 dark:hover:text-white"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
