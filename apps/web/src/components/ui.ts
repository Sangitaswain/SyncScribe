// Shared class names for a consistent, minimal look.

export const inputClass =
  "w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none transition focus:border-brand focus:ring-3 focus:ring-brand/15 dark:border-white/10 dark:bg-white/5";

export const primaryButton =
  "rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-dark disabled:opacity-60";

/** A sidebar / list row. */
export const rowClass = (active = false) =>
  `flex h-8 items-center gap-2 rounded-md px-2 text-[14px] transition-colors ${
    active ? "bg-active font-medium dark:bg-white/10" : "text-ink/90 hover:bg-hover dark:text-white/85 dark:hover:bg-white/5"
  }`;
