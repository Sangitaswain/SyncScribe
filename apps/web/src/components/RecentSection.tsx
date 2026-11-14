import { Link } from "react-router";
import { Clock } from "lucide-react";
import { WS, wsDoc } from "@syncscribe/shared";
import { useDoc, useY } from "../crdt/hooks";
import { useDocTitle } from "../crdt/titles";
import type { Recent } from "../crdt/prefs";
import type { TreeItem } from "../crdt/tree";

function RecentRow({ id }: { id: string }) {
  const title = useDocTitle(id);
  return (
    <Link to={`/doc/${id}`} className="flex items-center gap-1.5 truncate rounded px-2 py-1 text-sm hover:bg-slate-200/70 dark:hover:bg-slate-700">
      <Clock className="size-3.5 shrink-0 text-slate-400" />
      <span className="truncate">{title || "Untitled"}</span>
    </Link>
  );
}

/** The 5 most recently opened documents of this workspace that aren't in Trash (B9). */
export default function RecentSection({ workspaceId, recents }: { workspaceId: string; recents: Recent[] }) {
  const ws = useDoc(wsDoc(workspaceId));
  const items = useY<Record<string, TreeItem>>(ws?.getMap(WS.items)) ?? {};
  const shown = recents.filter((r) => items[r.docId] && !items[r.docId].deletedAt).slice(0, 5);
  if (!shown.length) return null;
  return (
    <section>
      <p className="px-2 pb-1 text-xs font-semibold tracking-wide text-slate-500 uppercase">Recent</p>
      {shown.map((r) => (
        <RecentRow key={r.docId} id={r.docId} />
      ))}
    </section>
  );
}
