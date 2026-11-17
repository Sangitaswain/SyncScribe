import { X } from "lucide-react";
import { useStorage, WARNINGS } from "../services/storage";

/** Device storage warnings (EC24, EC25, EC27, EC40). */
export default function StorageBanner() {
  const warning = useStorage((s) => s.warning);
  if (!warning) return null;
  return (
    <div role="alert" className="flex shrink-0 items-center gap-2 bg-panel px-4 py-1.5 text-xs text-muted dark:bg-white/5">
      <span className="min-w-0 flex-1">{WARNINGS[warning]}</span>
      {warning !== "unavailable" && (
        <button
          onClick={() => useStorage.setState({ warning: null })}
          aria-label="Dismiss"
          className="rounded-md p-0.5 hover:bg-hover hover:text-ink dark:hover:bg-white/5 dark:hover:text-white"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}
