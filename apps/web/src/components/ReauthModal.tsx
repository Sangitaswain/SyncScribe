import { useState, type FormEvent } from "react";
import type { AuthResponse } from "@syncscribe/shared";
import { useSession } from "../stores/session";
import { api } from "../services/api";
import { saveSession } from "../services/session";
import { buttonClass, inputClass } from "../routes/AuthPage";

/** Session expired: sign in again without losing anything saved on this device (EC19). */
export default function ReauthModal() {
  const { status, user } = useSession();
  const [error, setError] = useState("");
  if (status !== "needsReauth" || !user) return null;

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const password = String(new FormData(e.currentTarget).get("password"));
    try {
      await saveSession(await api<AuthResponse>("/auth/login", { body: { email: user!.email, password } }));
      setError("");
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <form onSubmit={onSubmit} className="flex w-full max-w-sm flex-col gap-3 rounded-xl bg-white p-6 shadow-xl dark:bg-slate-800">
        <h2 className="text-lg font-semibold">Please sign in again</h2>
        <p className="text-sm text-slate-500">
          Your session expired. Everything is still saved on this device and will sync after you sign in.
        </p>
        <input value={user.email} readOnly className={`${inputClass} opacity-70`} />
        <input name="password" type="password" placeholder="Password" autoFocus className={inputClass} />
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <button className={buttonClass}>Sign in</button>
      </form>
    </div>
  );
}
