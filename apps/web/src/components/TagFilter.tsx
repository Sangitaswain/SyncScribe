import { Tag } from "lucide-react";

/** Show only documents with one tag (B7). Hidden until some document has a tag. */
export default function TagFilter({ tags, value, onChange }: { tags: string[]; value: string | null; onChange: (tag: string | null) => void }) {
  if (!tags.length) return null;
  return (
    <label className="flex items-center gap-0.5 text-[12px] text-muted" title="Filter by tag">
      <Tag className="size-3.5" />
      <select
        value={value && tags.includes(value) ? value : ""}
        onChange={(e) => onChange(e.target.value || null)}
        className="max-w-24 rounded bg-transparent py-0.5 text-[12px] outline-none hover:bg-hover"
        aria-label="Filter by tag"
      >
        <option value="">All tags</option>
        {tags.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
    </label>
  );
}
