import { useState, type FormEvent } from "react";
import { COLORS, type AuthResponse } from "@syncscribe/shared";
import { useSession } from "../stores/session";
import { api } from "../services/api";
import { saveSession } from "../services/session";
import { toast } from "../stores/ui";
import { inputClass } from "./AuthPage";

/** Profile: display name and cursor colour shown to collaborators (A4). */
export default function SettingsPage() {
  const user = useSession((s) => s.user)!;
  const [color, setColor] = useState(user.color);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const name = String(new FormData(e.currentTarget).get("name")).trim();
    try {
      await saveSession(await api<AuthResponse>("/me", { method: "PATCH", body: { name, color } }));
      toast("Profile saved", "success");
    } catch (err) {
      toast((err as Error).message, "error");
    }
  }

  return (
    <div className="mx-auto max-w-lg p-6">
      <h1 className="mb-6 text-xl font-semibold">Settings</h1>
      <form onSubmit={onSubmit} className="flex flex-col gap-4 rounded-xl border border-slate-200 p-5 dark:border-slate-700">
        <h2 className="font-semibold">Profile</h2>
        <label className="flex flex-col gap-1 text-sm">
          Name
          <input name="name" defaultValue={user.name} required className={inputClass} />
        </label>
        <div className="text-sm">
          Cursor colour
          <div className="mt-2 flex gap-2">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                aria-label={`Colour ${c}`}
                className={`size-7 rounded-full ${c === color ? "ring-2 ring-slate-900 ring-offset-2 dark:ring-white" : ""}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>
        <p className="text-xs text-slate-500">Email: {user.email}. Changing your profile needs a connection.</p>
        <button className="self-start rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
          Save
        </button>
      </form>
    </div>
  );
}
