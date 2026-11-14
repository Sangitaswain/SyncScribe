import { Navigate } from "react-router";
import { WifiOff } from "lucide-react";
import { useSession } from "../stores/session";

/** App screens need a session. A cached session works offline (A3); none + offline = can't set up (EC4). */
export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const status = useSession((s) => s.status);
  if (status === "loading") return null;
  if (status !== "signedOut") return children;
  if (navigator.onLine) return <Navigate to="/welcome" replace />; // signed-out visitors see the landing page
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 p-6 text-center text-muted">
      <WifiOff className="size-10 text-muted/60" />
      <p className="text-lg font-semibold text-ink dark:text-white">Connect once to set up SyncScribe</p>
      <p className="text-sm">Sign in while online on this device. After that, it works offline.</p>
    </div>
  );
}
