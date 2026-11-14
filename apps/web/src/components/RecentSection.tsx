import { Link } from "react-router";
import { FileText } from "lucide-react";
import { rowClass } from "./ui";
import { WS, wsDoc } from "@syncscribe/shared";
import { useDoc, useY } from "../crdt/hooks";
import { useDocTitle } from "../crdt/titles";
import type { Recent } from "../crdt/prefs";
import type { TreeItem } from "../crdt/tree";

function RecentRow({ id }: { id: string }) {
  const title = useDocTitle(id);
  return (
    <Link to={`/doc/${id}`} className={rowClass()}>
      <FileText className="size-4 shrink-0 text-muted" />
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
    <section className="flex flex-col gap-1">
      <p className="px-2 text-[12px] font-medium text-muted">Recent</p>
      {shown.map((r) => (
        <RecentRow key={r.docId} id={r.docId} />
      ))}
    </section>
  );
}
