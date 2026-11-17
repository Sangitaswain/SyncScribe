import { useState } from "react";
import { CloudCheck, UserPlus, WifiOff } from "lucide-react";
import { setSetting, usePrefs } from "../crdt/prefs";
import { primaryButton } from "./ui";

const STEPS = [
  {
    Icon: WifiOff,
    title: "Works without internet",
    text: "Everything you type is saved on this device the moment you type it. There is no Save button, and you can keep working offline.",
  },
  {
    Icon: CloudCheck,
    title: "Syncs by itself",
    text: "When you're online, changes sync in the background. The badge at the top shows Online, Offline, Syncing, Synced or Sync error. Edits from different people merge automatically.",
  },
  {
    Icon: UserPlus,
    title: "Write together",
    text: "Use Share to invite people as Editor, Commenter or Viewer. One thing to know: clearing your browser data deletes changes that haven't synced yet.",
  },
];

/** A three-step first-run guide, shown once per user on any device (J4, EC26). */
export default function WelcomeTour() {
  const { doc: prefs, settings } = usePrefs();
  const [step, setStep] = useState(0);
  if (!prefs || settings.tourDone) return null;

  const finish = () => setSetting(prefs, "tourDone", true);
  const { Icon, title, text } = STEPS[step];
  const last = step === STEPS.length - 1;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div role="dialog" aria-label="Welcome to SyncScribe" className="flex w-full max-w-sm flex-col gap-4 rounded-2xl bg-white p-6 shadow-xl dark:bg-[#1c1c1c]">
        <span className="flex size-10 items-center justify-center rounded-xl bg-brand/10 text-brand">
          <Icon className="size-5" />
        </span>
        <div>
          <p className="text-xs text-muted">
            Step {step + 1} of {STEPS.length}
          </p>
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="mt-1 text-sm text-muted">{text}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={finish} className="text-sm text-muted hover:underline">
            Skip
          </button>
          {step > 0 && (
            <button onClick={() => setStep(step - 1)} className="ml-auto rounded-lg px-3 py-2 text-sm hover:bg-hover dark:hover:bg-white/5">
              Back
            </button>
          )}
          <button onClick={last ? finish : () => setStep(step + 1)} className={`${primaryButton} ${step > 0 ? "" : "ml-auto"}`}>
            {last ? "Start writing" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}
