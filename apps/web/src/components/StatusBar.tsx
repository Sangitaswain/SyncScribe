import { useEditorStats } from "../stores/editorStats";
import { readingMinutes } from "../lib/text";

/** "Saved on this device", word count and reading time (C6, C12). Sync status joins in Step 11. */
export default function StatusBar() {
  const words = useEditorStats((s) => s.words);
  return (
    <footer className="flex h-7 shrink-0 items-center gap-4 px-4 text-[11px] text-muted">
      <span>Saved on this device</span>
      {words !== null && (
        <span className="ml-auto">
          {words} {words === 1 ? "word" : "words"} · {readingMinutes(words)} min read
        </span>
      )}
    </footer>
  );
}
