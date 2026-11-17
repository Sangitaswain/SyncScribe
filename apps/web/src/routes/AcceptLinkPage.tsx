import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import type { Role } from "@syncscribe/shared";
import { api } from "../services/api";
import { useSession } from "../stores/session";
import { AuthCard } from "./AuthPage";

/** Opening a share link: adds the shared doc for the signed-in person, then opens it (G3, EC23). */
export default function AcceptLinkPage() {
  const { token } = useParams();
  const status = useSession((s) => s.status);
  const navigate = useNavigate();
  const [error, setError] = useState("");

  useEffect(() => {
    if (status !== "signedIn" || !token) return;
    if (!navigator.onLine) return setError("Connect to the internet to open this link.");
    api<{ resourceId: string; role: Role }>(`/share-links/${token}/accept`, { method: "POST" })
      .then(({ resourceId }) => navigate(`/doc/${resourceId}`, { replace: true }))
      .catch((e) => setError((e as Error).message)); // e.g. "This link is no longer active"
  }, [status, token, navigate]);

  if (status === "loading") return null;
  if (status === "signedOut") {
    const next = encodeURIComponent(`/s/${token}`);
    return (
      <AuthCard title="Open a shared document">
        <p className="mb-6 text-sm text-muted">Sign in or create an account to open the document shared with you.</p>
        <div className="flex justify-between text-[13px]">
          <Link to={`/login?next=${next}`} className="text-brand hover:underline">Sign in</Link>
          <Link to={`/signup?next=${next}`} className="text-brand hover:underline">Create an account</Link>
        </div>
      </AuthCard>
    );
  }
  return (
    <AuthCard title={error ? "Can't open this link" : "Opening…"}>
      {error && (
        <>
          <p className="mb-6 text-sm text-muted">{error}</p>
          <Link to="/" className="text-[13px] text-brand hover:underline">Go to your documents</Link>
        </>
      )}
    </AuthCard>
  );
}
