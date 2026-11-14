import { Navigate } from "react-router";
import { WifiOff } from "lucide-react";
import { useSession } from "../stores/session";

/** App screens need a session. A cached session works offline (A3); none + offline = can't set up (EC4). */
export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const status = useSession((s) => s.status);
  if (status === "loading") return null;
  if (status !== "signedOut") return children;
  if (navigator.onLine) return <Navigate to="/login" replace />;
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 p-6 text-center text-slate-600 dark:bg-slate-900 dark:text-slate-300">
      <WifiOff className="size-10 text-slate-400" />
      <p className="text-lg font-semibold">Connect once to set up SyncScribe</p>
      <p className="text-sm">Sign in while online on this device. After that, it works offline.</p>
    </div>
  );
}
