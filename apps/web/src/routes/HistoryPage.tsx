import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";
import * as Y from "yjs";
import { ArrowLeft } from "lucide-react";
import { DOC, docDoc, versionNameSchema, type Version } from "@syncscribe/shared";
import { useDoc } from "../crdt/hooks";
import { replaceContent } from "../crdt/tree";
import { api, API_URL } from "../services/api";
import { sendOrQueue } from "../services/outbox";
import { useNetwork } from "../stores/network";
import { useSession } from "../stores/session";
import { toast } from "../stores/ui";
import MarkdownPreview from "../editor/MarkdownPreview";
import { inputClass, primaryButton } from "../components/ui";

const when = (ms: number) => new Date(ms).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

/** Downloads a version's Yjs state and decodes it into a throwaway doc for the preview. */
async function loadVersion(vid: string) {
  const res = await fetch(`${API_URL}/api/versions/${vid}`, { headers: { Authorization: `Bearer ${useSession.getState().token}` } });
  if (!res.ok) throw new Error("Couldn't load this version");
  const doc = new Y.Doc();
  Y.applyUpdate(doc, new Uint8Array(await res.arrayBuffer()));
  return doc;
}

/** Version history of a document: browse, preview, name and restore versions (H1, H3, H4, 4.9). */
export default function HistoryPage() {
  const { docId = "" } = useParams();
  const online = useNetwork((s) => s.serverReachable);
  const doc = useDoc(docDoc(docId));
  const navigate = useNavigate();
  const [versions, setVersions] = useState<Version[]>([]);
  const [selected, setSelected] = useState<{ v: Version; doc: Y.Doc } | null>(null);
  const [message, setMessage] = useState("");

  const load = useCallback(
    () =>
      api<{ versions: Version[] }>(`/docs/${docId}/versions`)
        .then((r) => setVersions(r.versions))
        .catch((e) => setMessage((e as Error).message)),
    [docId],
  );
  useEffect(() => {
    if (online) load();
  }, [online, load]);

  const select = (v: Version) =>
    loadVersion(v.id)
      .then((d) => setSelected({ v, doc: d }))
      .catch((e) => setMessage((e as Error).message));

  async function restore() {
    if (!doc || !selected) return;
    try {
      // Keep today's text as a named version first, so the restore can be undone from history (4.9 step 4)
      await api(`/docs/${docId}/versions`, { body: { name: `Before restoring ${when(selected.v.createdAt)}` } });
      replaceContent(doc, selected.doc.getText(DOC.content).toString());
      toast("Version restored", "success");
      navigate(`/doc/${docId}`);
    } catch (e) {
      setMessage((e as Error).message);
    }
  }

  async function nameCurrent(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const parsed = versionNameSchema.safeParse(Object.fromEntries(new FormData(form)));
    if (!parsed.success) return setMessage("Please enter a name");
    try {
      const saved = await sendOrQueue(`Name version "${parsed.data.name}"`, "POST", `/docs/${docId}/versions`, parsed.data);
      setMessage(saved ? "Version saved" : "The version will be saved when you're back online");
      form.reset();
      if (saved) load();
    } catch (err) {
      setMessage((err as Error).message);
    }
  }

  async function rename(v: Version) {
    const input = document.getElementById("rename-version") as HTMLInputElement | null;
    const parsed = versionNameSchema.safeParse({ name: input?.value });
    if (!parsed.success) return setMessage("Please enter a name");
    try {
      const updated = await api<Version>(`/versions/${v.id}`, { method: "PATCH", body: parsed.data });
      setSelected((s) => s && { ...s, v: updated });
      load();
    } catch (err) {
      setMessage((err as Error).message);
    }
  }

  return (
    <div className="mx-auto flex h-full max-w-[1100px] flex-col gap-4 px-6 pt-6 pb-6">
      <div className="flex items-center gap-3">
        <Link to={`/doc/${docId}`} aria-label="Back to document" className="rounded-md p-1.5 text-muted hover:bg-hover hover:text-ink">
          <ArrowLeft className="size-4" />
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">Version history</h1>
      </div>
      {!online && <p className="text-sm text-muted">Version history needs a connection. Your document still works offline.</p>}
      {message && <p className="text-sm text-muted" role="status">{message}</p>}

      <form onSubmit={nameCurrent} className="flex max-w-md gap-2">
        <input name="name" placeholder="Name the current version" aria-label="Version name" className={inputClass} />
        <button className={primaryButton}>Save</button>
      </form>

      <div className="grid min-h-0 flex-1 gap-4 md:grid-cols-[280px_1fr]">
        <ul className="flex flex-col gap-1 overflow-y-auto" aria-label="Versions">
          {online && !versions.length && <li className="text-sm text-muted">No versions yet. They are saved as you edit.</li>}
          {versions.map((v) => (
            <li key={v.id}>
              <button
                onClick={() => select(v)}
                className={`w-full rounded-md px-3 py-2 text-left text-sm ${selected?.v.id === v.id ? "bg-active dark:bg-white/10" : "hover:bg-hover dark:hover:bg-white/5"}`}
              >
                {v.name && <span className="block font-medium text-brand">{v.name}</span>}
                <span className="block">{when(v.createdAt)}</span>
                <span className="block truncate text-xs text-muted">{v.authors.join(", ") || "Unknown"}</span>
              </button>
            </li>
          ))}
        </ul>

        {selected && (
          <section className="flex min-h-0 flex-col gap-3 rounded-xl border border-line p-4 dark:border-white/10">
            <div className="flex flex-wrap items-center gap-2">
              <input
                id="rename-version"
                key={selected.v.id}
                defaultValue={selected.v.name ?? ""}
                placeholder="Name this version"
                aria-label="Rename version"
                className={`${inputClass} max-w-xs`}
              />
              <button onClick={() => rename(selected.v)} className="text-sm font-medium text-brand hover:underline">
                Rename
              </button>
              <button onClick={restore} disabled={!online || !doc} className={`${primaryButton} ml-auto`}>
                Restore this version
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <MarkdownPreview ytext={selected.doc.getText(DOC.content)} />
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
