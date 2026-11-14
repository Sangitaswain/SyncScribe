import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import { api } from "../services/api";
import { AuthCard, buttonClass, inputClass } from "./AuthPage";

/** Request a password reset link (A5). Needs a connection. */
export default function ForgotPage() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    try {
      await api("/auth/forgot", { body: { email: new FormData(e.currentTarget).get("email") } });
      setSent(true);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <AuthCard title="Reset your password">
      {sent ? (
        <p className="text-sm">If an account exists for that email, we've sent a reset link. It works for 1 hour.</p>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <input name="email" type="email" required placeholder="Email" className={inputClass} />
          {error && <p className="text-sm text-rose-600">{error}</p>}
          <button className={buttonClass}>Send reset link</button>
        </form>
      )}
      <Link to="/login" className="mt-4 inline-block text-sm text-indigo-600 hover:underline">Back to sign in</Link>
    </AuthCard>
  );
}
