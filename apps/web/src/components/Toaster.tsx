import { useUi } from "../stores/ui";

const colors = {
  info: "bg-slate-800 text-white",
  success: "bg-emerald-600 text-white",
  error: "bg-rose-600 text-white",
};

/** Brief notices ("All changes synced", errors). */
export default function Toaster() {
  const toasts = useUi((s) => s.toasts);
  return (
    <div aria-live="polite" className="pointer-events-none fixed right-4 bottom-10 z-50 flex flex-col gap-2">
      {toasts.map((t) => (
        <div key={t.id} className={`rounded-md px-3 py-2 text-sm shadow-lg ${colors[t.kind]}`}>
          {t.message}
        </div>
      ))}
    </div>
  );
}
