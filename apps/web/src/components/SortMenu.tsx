import { ArrowUpDown } from "lucide-react";
import type { SortMode } from "../crdt/resolveTree";

const LABELS: Record<SortMode, string> = { manual: "Manual", name: "Name", created: "Newest", edited: "Last edited" };

/** Sort the tree (B6); the choice is saved in user preferences. */
export default function SortMenu({ value, onChange }: { value: SortMode; onChange: (m: SortMode) => void }) {
  return (
    <label className="flex items-center gap-0.5 text-[12px] text-muted" title="Sort documents">
      <ArrowUpDown className="size-3.5" />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as SortMode)}
        className="rounded bg-transparent py-0.5 text-[12px] outline-none hover:bg-hover"
        aria-label="Sort documents"
      >
        {(Object.keys(LABELS) as SortMode[]).map((m) => (
          <option key={m} value={m}>{LABELS[m]}</option>
        ))}
      </select>
    </label>
  );
}
