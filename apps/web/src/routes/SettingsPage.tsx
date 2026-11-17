import { useEffect, useState, type FormEvent } from "react";
import { COLORS, type AuthResponse } from "@syncscribe/shared";
import { useSession } from "../stores/session";
import { api } from "../services/api";
import { saveSession } from "../services/session";
import { toast } from "../stores/ui";
import { inputClass, primaryButton } from "../components/ui";
import { formatSize, refreshUsage, useStorage } from "../services/storage";

/** Device storage used by SyncScribe (D7) and what clearing browser data means (EC26). */
function StorageSection() {
  const { usage, quota } = useStorage();
  useEffect(() => {
    refreshUsage();
  }, []);
  return (
    <section className="mt-6 flex flex-col gap-2 rounded-2xl border border-line p-6 text-sm dark:border-white/10">
      <h2 className="font-semibold">Storage on this device</h2>
      <p>{usage !== null && quota !== null ? `SyncScribe uses ${formatSize(usage)} of ${formatSize(quota)} available.` : "Storage use isn't available in this browser."}</p>
      <p className="text-muted">
        Clearing your browser data deletes changes that haven't synced yet. Documents that have synced come back when you sign in again.
      </p>
    </section>
  );
}

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
    <div className="mx-auto max-w-[640px] px-6 pt-10">
      <h1 className="mb-8 text-[32px] font-bold tracking-tight">Settings</h1>
      <form onSubmit={onSubmit} className="flex flex-col gap-4 rounded-2xl border border-line p-6 dark:border-white/10">
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
                className={`size-7 rounded-full ${c === color ? "ring-2 ring-brand ring-offset-2 dark:ring-offset-[#141414]" : ""}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>
        <p className="text-xs text-muted">Email: {user.email}. Changing your profile needs a connection.</p>
        <button className={`${primaryButton} self-start`}>
          Save
        </button>
      </form>
      <StorageSection />
    </div>
  );
}
