import { useEffect, useRef, useState, type FormEvent } from "react";
import type { EditorView } from "@codemirror/view";
import type * as Y from "yjs";
import { X } from "lucide-react";
import { CM, type Member, type Share } from "@syncscribe/shared";
import { useY } from "../crdt/hooks";
import { addReply, addThread, anchorOf, listThreads, setResolved, type Author, type Thread } from "../crdt/comments";
import { useUi } from "../stores/ui";
import { useNetwork } from "../stores/network";
import { usePresence } from "../stores/presence";
import { useSession } from "../stores/session";
import { api } from "../services/api";
import { sendOrQueue } from "../services/outbox";
import { inputClass, primaryButton } from "../components/ui";

/** People named as @Name in `body`. */
export const mentionsIn = (body: string, people: Author[]) =>
  people.filter((p) => body.toLowerCase().includes(`@${p.name.toLowerCase()}`)).map((p) => p.id);

/** Tells mentioned people, now or once back online (F5, FP-13). */
function notifyMentions(docId: string, threadId: string, userIds: string[]) {
  if (userIds.length)
    sendOrQueue("Sending a mention", "POST", "/mentions", { docId, threadId, userIds }).catch(() => {});
}

/** Everyone who could be mentioned: people here now, comment authors, and (when online) shares and members. */
function usePeople(docId: string, threads: Thread[], me: Author) {
  const present = usePresence((s) => s.users);
  const online = useNetwork((s) => s.serverReachable);
  const workspaceId = useSession((s) => s.activeWorkspaceId);
  const [fetched, setFetched] = useState<Author[]>([]);
  useEffect(() => {
    if (!online) return;
    const found: Author[] = [];
    const shares = api<{ shares: Share[] }>(`/shares?resource=${docId}`)
      .then((r) => r.shares.forEach((s) => s.userId && s.name && found.push({ id: s.userId, name: s.name })))
      .catch(() => {}); // commenters may not see the list
    const members = api<{ members: Member[] }>(`/workspaces/${workspaceId}/members`)
      .then((r) => r.members.forEach((m) => found.push({ id: m.userId, name: m.name })))
      .catch(() => {});
    Promise.all([shares, members]).then(() => setFetched(found));
  }, [online, docId, workspaceId]);
  const all = [...present, ...threads.flatMap((t) => t.replies.map((r) => ({ id: r.authorId, name: r.authorName }))), ...fetched];
  return [...new Map(all.filter((p) => p.id !== me.id).map((p) => [p.id, { id: p.id, name: p.name }])).values()];
}

const when = (ms: number) => new Date(ms).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const link = "text-xs font-medium text-brand hover:underline";

function ThreadCard({
  thread,
  cm,
  doc,
  view,
  me,
  canComment,
  docId,
  people,
}: {
  thread: Thread;
  cm: Y.Doc;
  doc: Y.Doc;
  view: EditorView | null;
  me: Author;
  canComment: boolean;
  docId: string;
  people: Author[];
}) {
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
            const mentions = mentionsIn(draft, people);
            addReply(cm, thread.id, draft, me, mentions);
            notifyMentions(docId, thread.id, mentions);
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
export default function CommentsPanel({
  cm,
  doc,
  docId,
  view,
  me,
  canComment,
}: {
  cm: Y.Doc;
  doc: Y.Doc;
  docId: string;
  view: EditorView | null;
  me: Author;
  canComment: boolean;
}) {
  useY(cm.getMap(CM.threads)); // re-render on any change
  const [message, setMessage] = useState("");
  const threads = listThreads(cm);
  const people = usePeople(docId, threads, me);
  const box = useRef<HTMLTextAreaElement>(null);

  function add(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const body = String(new FormData(form).get("body") ?? "").trim();
    const sel = view?.state.selection.main;
    if (!sel || sel.empty) return setMessage("Select some text in the document first.");
    if (!body) return setMessage("Write a comment first.");
    const mentions = mentionsIn(body, people);
    notifyMentions(docId, addThread(cm, doc, sel.from, sel.to, body, me, mentions), mentions);
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
          <textarea ref={box} name="body" rows={2} placeholder="Comment on the selected text. Type @ and a name to mention someone." aria-label="New comment" className={inputClass} />
          {people.length > 0 && (
            <div className="flex flex-wrap items-center gap-1 text-xs text-muted">
              Mention:
              {people.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    if (!box.current) return;
                    box.current.value = `${box.current.value}@${p.name} `.trimStart();
                    box.current.focus();
                  }}
                  className="rounded-full bg-panel px-2 py-0.5 hover:text-ink dark:bg-white/5"
                >
                  @{p.name}
                </button>
              ))}
            </div>
          )}
          <button className={`${primaryButton} self-start`}>Comment</button>
        </form>
      ) : (
        <p className="text-sm text-muted">You can read comments but not add them.</p>
      )}
      {message && <p className="text-sm text-muted" role="status">{message}</p>}
      {!threads.length && <p className="text-sm text-muted">No comments yet.</p>}
      <ul className="flex flex-col gap-3">
        {threads.map((t) => (
          <ThreadCard key={t.id} thread={t} cm={cm} doc={doc} view={view} me={me} canComment={canComment} docId={docId} people={people} />
        ))}
      </ul>
    </aside>
  );
}
