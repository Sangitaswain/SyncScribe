import { Columns2, Eye, Pencil } from "lucide-react";

export type EditorMode = "edit" | "split" | "preview";

const MODES = [
  { mode: "edit", label: "Edit", Icon: Pencil },
  { mode: "split", label: "Side by side", Icon: Columns2 },
  { mode: "preview", label: "Preview", Icon: Eye },
] as const;

/** Edit / side-by-side / preview (C3); the choice is saved in user preferences. */
export default function ModeSwitch({ value, onChange }: { value: EditorMode; onChange: (m: EditorMode) => void }) {
  return (
    <div role="radiogroup" aria-label="View mode" className="flex rounded-md border border-slate-200 p-0.5 dark:border-slate-700">
      {MODES.map(({ mode, label, Icon }) => (
        <button
          key={mode}
          role="radio"
          aria-checked={value === mode}
          aria-label={label}
          title={label}
          onClick={() => onChange(mode)}
          className={`rounded p-1 ${value === mode ? "bg-slate-200 dark:bg-slate-700" : "text-slate-500 hover:text-slate-900 dark:hover:text-white"}`}
        >
          <Icon className="size-4" />
        </button>
      ))}
    </div>
  );
}
