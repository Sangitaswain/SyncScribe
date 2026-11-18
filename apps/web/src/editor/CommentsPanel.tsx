import { useState, type FormEvent } from "react";
import type { EditorView } from "@codemirror/view";
import type * as Y from "yjs";
import { X } from "lucide-react";
import { CM } from "@syncscribe/shared";
import { useY } from "../crdt/hooks";
import { addReply, addThread, anchorOf, listThreads, setResolved, type Author, type Thread } from "../crdt/comments";
import { useUi } from "../stores/ui";
import { inputClass, primaryButton } from "../components/ui";

const when = (ms: number) => new Date(ms).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const link = "text-xs font-medium text-brand hover:underline";

function ThreadCard({ thread, cm, doc, view, me, canComment }: { thread: Thread; cm: Y.Doc; doc: Y.Doc; view: EditorView | null; me: Author; canComment: boolean }) {
  const [draft, setDraft] = useState("");
  // Jump to the commented text, wherever it is now
  const show = () => {
    const range = anchorOf(cm, doc, thread.id);
    if (view && range) view.dispatch({ selection: { anchor: range.from, head: range.to }, scrollIntoView: true });
  };
  return (
    <li className={`flex flex-col gap-2 rounded-xl border border-line p-3 text-sm dark:border-white/10 ${thread.resolved ? "opacity-60" : ""}`}>
      <button onClick={show} className="truncate border-l-2 border-brand/50 pl-2 text-left text-xs text-muted" title="Show in the document">
        {thread.quote || "(text was deleted)"}
      </button>
      {thread.replies.map((r) => (
        <div key={r.id}>
          <span className="font-medium">{r.authorName}</span> <span className="text-xs text-muted">{when(r.createdAt)}</span>
          <p className="whitespace-pre-wrap">{r.body}</p>
        </div>
      ))}
      {canComment && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!draft.trim()) return;
            addReply(cm, thread.id, draft, me);
            setDraft("");
          }}
          className="flex flex-col gap-2"
        >
          {!thread.resolved && <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Reply" aria-label="Reply" className={inputClass} />}
          <div className="flex gap-3">
            {!thread.resolved && <button className={link}>Reply</button>}
            <button type="button" onClick={() => setResolved(cm, thread.id, !thread.resolved)} className={link}>
              {thread.resolved ? "Reopen" : "Resolve"}
            </button>
          </div>
        </form>
      )}
    </li>
  );
}

/** Comments on selected text: add, reply, resolve, reopen; works offline (F4). */
export default function CommentsPanel({ cm, doc, view, me, canComment }: { cm: Y.Doc; doc: Y.Doc; view: EditorView | null; me: Author; canComment: boolean }) {
  useY(cm.getMap(CM.threads)); // re-render on any change
  const [message, setMessage] = useState("");
  const threads = listThreads(cm);

  function add(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const body = String(new FormData(form).get("body") ?? "").trim();
    const sel = view?.state.selection.main;
    if (!sel || sel.empty) return setMessage("Select some text in the document first.");
    if (!body) return setMessage("Write a comment first.");
    addThread(cm, doc, sel.from, sel.to, body, me);
    form.reset();
    setMessage("");
  }

  return (
    <aside aria-label="Comments" className="flex w-full shrink-0 flex-col gap-3 overflow-y-auto border-l border-line p-4 sm:w-80 dark:border-white/10">
      <div className="flex items-center">
        <h2 className="flex-1 font-semibold">Comments</h2>
        <button onClick={() => useUi.setState({ commentsOpen: false })} aria-label="Close comments" className="rounded-md p-1 text-muted hover:bg-hover hover:text-ink dark:hover:bg-white/5">
          <X className="size-4" />
        </button>
      </div>
      {canComment ? (
        <form onSubmit={add} className="flex flex-col gap-2">
          <textarea name="body" rows={2} placeholder="Comment on the selected text" aria-label="New comment" className={inputClass} />
          <button className={`${primaryButton} self-start`}>Comment</button>
        </form>
      ) : (
        <p className="text-sm text-muted">You can read comments but not add them.</p>
      )}
      {message && <p className="text-sm text-muted" role="status">{message}</p>}
      {!threads.length && <p className="text-sm text-muted">No comments yet.</p>}
      <ul className="flex flex-col gap-3">
        {threads.map((t) => (
          <ThreadCard key={t.id} thread={t} cm={cm} doc={doc} view={view} me={me} canComment={canComment} />
        ))}
      </ul>
    </aside>
  );
}
