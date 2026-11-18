import { Link } from "react-router";
import { FileText } from "lucide-react";
import { rowClass } from "./ui";
import { WS, wsDoc } from "@syncscribe/shared";
import { useDoc, useY } from "../crdt/hooks";
import { useDocTitle } from "../crdt/titles";
import type { TreeItem } from "../crdt/tree";

function DocRow({ id }: { id: string }) {
  const title = useDocTitle(id);
  return (
    <Link to={`/doc/${id}`} className={rowClass()}>
      <FileText className="size-4 shrink-0 text-muted" />
      <span className="truncate">{title || "Untitled"}</span>
    </Link>
  );
}

/** A short list of documents of this workspace that aren't in Trash: Pinned (B8) or Recent (B9). */
export default function DocSection({ title, workspaceId, ids, limit }: { title: string; workspaceId: string; ids: string[]; limit?: number }) {
  const ws = useDoc(wsDoc(workspaceId));
  const items = useY<Record<string, TreeItem>>(ws?.getMap(WS.items)) ?? {};
  const shown = ids.filter((id) => items[id]?.type === "doc" && !items[id].deletedAt).slice(0, limit);
  if (!shown.length) return null;
  return (
    <section className="flex flex-col gap-1">
      <p className="px-2 text-[12px] font-medium text-muted">{title}</p>
      {shown.map((id) => (
        <DocRow key={id} id={id} />
      ))}
    </section>
  );
}
