import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { NotebookPen } from "lucide-react";
import { loginSchema, signupSchema, type AuthResponse } from "@syncscribe/shared";
import { api } from "../services/api";
import { saveSession } from "../services/session";
import { bootstrap } from "../services/bootstrap";

import { inputClass, primaryButton } from "../components/ui";

export { inputClass };
export const buttonClass = `${primaryButton} w-full py-2.5`;

export function AuthCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-panel p-4 dark:bg-[#141414]">
      <div className="w-full max-w-[380px] rounded-2xl bg-white p-8 shadow-[0_8px_30px_rgb(0_0_0/0.06)] dark:bg-[#1c1c1c]">
        <Link to="/welcome" className="mb-8 flex items-center gap-2 text-[15px] font-semibold">
          <span className="flex size-7 items-center justify-center rounded-lg bg-brand text-white">
            <NotebookPen className="size-4" />
          </span>
          SyncScribe
        </Link>
        <h1 className="mb-6 text-2xl font-bold tracking-tight">{title}</h1>
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
        {error && <p className="text-[13px] text-rose-600">{error}</p>}
        <button disabled={busy} className={buttonClass}>
          {busy ? "Please wait…" : signup ? "Sign up" : "Sign in"}
        </button>
      </form>
      <div className="mt-6 flex justify-between text-[13px]">
        {signup ? (
          <Link to="/login" className="text-brand hover:underline">Already have an account? Sign in</Link>
        ) : (
          <>
            <Link to="/signup" className="text-brand hover:underline">Create an account</Link>
            <Link to="/forgot" className="text-muted hover:underline">Forgot password?</Link>
          </>
        )}
      </div>
    </AuthCard>
  );
}
