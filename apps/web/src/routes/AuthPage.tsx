import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { NotebookPen } from "lucide-react";
import { loginSchema, signupSchema, type AuthResponse } from "@syncscribe/shared";
import { api } from "../services/api";
import { saveSession } from "../services/session";
import { bootstrap } from "../services/bootstrap";

export const inputClass =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:border-slate-600 dark:bg-slate-800";
export const buttonClass =
  "w-full rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60";

export function AuthCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-50 p-4 text-slate-900 dark:bg-slate-900 dark:text-slate-100">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="mb-6 flex items-center gap-2 text-lg font-semibold">
          <NotebookPen className="size-6 text-indigo-600" /> SyncScribe
        </div>
        <h1 className="mb-4 text-xl font-semibold">{title}</h1>
        {children}
      </div>
    </div>
  );
}

/** Sign up and sign in (A1, A2). */
export default function AuthPage({ mode }: { mode: "login" | "signup" }) {
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const signup = mode === "signup";

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = Object.fromEntries(new FormData(e.currentTarget));
    const parsed = (signup ? signupSchema : loginSchema).safeParse(form);
    if (!parsed.success) {
      const field = String(parsed.error.issues[0].path[0]);
      return setError(field === "password" ? "Password must be at least 8 characters" : `Please enter a valid ${field}`);
    }
    setBusy(true);
    setError("");
    try {
      await saveSession(await api<AuthResponse>(`/auth/${mode}`, { body: parsed.data }));
      await bootstrap(); // download the Welcome doc / existing documents to this device
      navigate("/");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthCard title={signup ? "Create your account" : "Sign in"}>
      <form onSubmit={onSubmit} className="flex flex-col gap-3" noValidate>
        {signup && <input name="name" placeholder="Name" autoComplete="name" className={inputClass} />}
        <input name="email" type="email" placeholder="Email" autoComplete="email" className={inputClass} />
        <input
          name="password"
          type="password"
          placeholder={signup ? "Password (at least 8 characters)" : "Password"}
          autoComplete={signup ? "new-password" : "current-password"}
          className={inputClass}
        />
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <button disabled={busy} className={buttonClass}>
          {busy ? "Please wait…" : signup ? "Sign up" : "Sign in"}
        </button>
      </form>
      <div className="mt-4 flex justify-between text-sm">
        {signup ? (
          <Link to="/login" className="text-indigo-600 hover:underline">Already have an account? Sign in</Link>
        ) : (
          <>
            <Link to="/signup" className="text-indigo-600 hover:underline">Create an account</Link>
            <Link to="/forgot" className="text-slate-500 hover:underline">Forgot password?</Link>
          </>
        )}
      </div>
    </AuthCard>
  );
}
