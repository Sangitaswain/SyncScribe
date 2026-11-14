import { NotebookPen } from "lucide-react";

export default function App() {
  return (
    <div className="flex min-h-screen items-center justify-center gap-3 bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100">
      <NotebookPen className="size-8 text-indigo-600" />
      <h1 className="text-2xl font-semibold">SyncScribe</h1>
    </div>
  );
}
