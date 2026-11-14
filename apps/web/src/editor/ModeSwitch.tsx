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
    <div role="radiogroup" aria-label="View mode" className="flex rounded-lg bg-panel p-0.5 dark:bg-white/5">
      {MODES.map(({ mode, label, Icon }) => (
        <button
          key={mode}
          role="radio"
          aria-checked={value === mode}
          aria-label={label}
          title={label}
          onClick={() => onChange(mode)}
          className={`rounded-md p-1 transition ${value === mode ? "bg-white text-ink shadow-sm dark:bg-white/15 dark:text-white" : "text-muted hover:text-ink dark:hover:text-white"}`}
        >
          <Icon className="size-4" />
        </button>
      ))}
    </div>
  );
}
