import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router";
import { api } from "../services/api";
import { AuthCard, buttonClass, inputClass } from "./AuthPage";

/** Choose a new password from an emailed link (A5). */
export default function ResetPage() {
  const { token } = useParams();
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const password = String(new FormData(e.currentTarget).get("password"));
    if (password.length < 8) return setError("Password must be at least 8 characters");
    try {
      await api("/auth/reset", { body: { token, password } });
      setDone(true);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <AuthCard title="Choose a new password">
      {done ? (
        <p className="text-sm">
          Password updated. <Link to="/login" className="text-brand hover:underline">Sign in</Link>
        </p>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <input name="password" type="password" placeholder="New password (at least 8 characters)" className={inputClass} />
          {error && <p className="text-[13px] text-rose-600">{error}</p>}
          <button className={buttonClass}>Update password</button>
        </form>
      )}
    </AuthCard>
  );
}
