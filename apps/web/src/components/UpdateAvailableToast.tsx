import { useRegisterSW } from "virtual:pwa-register/react";

/** Shown when a new version is ready. The current version keeps working offline until reload (EC30). */
export default function UpdateAvailableToast() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();
  if (!needRefresh) return null;
  return (
    <div className="fixed bottom-10 left-4 z-50 flex items-center gap-3 rounded-md bg-slate-800 px-3 py-2 text-sm text-white shadow-lg">
      New version available
      <button className="font-semibold text-indigo-300 hover:underline" onClick={() => updateServiceWorker(true)}>
        Reload
      </button>
      <button className="text-slate-400 hover:text-white" onClick={() => setNeedRefresh(false)} aria-label="Dismiss">
        ✕
      </button>
    </div>
  );
}
