import { useEffect, useState } from "react";
import { Link } from "react-router";
import { FileText, Folder } from "lucide-react";
import { get, set } from "idb-keyval";
import { docDoc, type SharedItem } from "@syncscribe/shared";
import { api } from "../services/api";
import { useSession } from "../stores/session";
import { useNetwork } from "../stores/network";
import { useDocStatus } from "../stores/docStatus";

const ROLE = { editor: "Can edit", commenter: "Can comment", viewer: "Can view" };

/** Documents and folders other people shared with me; the last list is kept for offline use (G1, 4.8). */
export default function SharedPage() {
  const userId = useSession((s) => s.user?.id);
  const online = useNetwork((s) => s.serverReachable);
  const statuses = useDocStatus((s) => s);
  const [items, setItems] = useState<SharedItem[] | null>(null);
  const key = `${userId}:shared`;

  useEffect(() => {
    get<SharedItem[]>(key).then((cached) => setItems((now) => now ?? cached ?? null));
    if (online)
      api<{ items: SharedItem[] }>("/shared-with-me")
        .then(({ items }) => {
          setItems(items);
          return set(key, items);
        })
        .catch(() => {}); // keep showing the cached list
  }, [key, online]);

  const shown = (items ?? []).filter((i) => !statuses[docDoc(i.id)]?.revoked); // access removed since
  return (
    <div className="mx-auto max-w-[800px] px-6 pt-10 pb-16">
      <h1 className="mb-6 text-[32px] font-bold tracking-tight">Shared with me</h1>
      {!online && <p className="mb-4 text-sm text-muted">You're offline. This is the list from your last connection.</p>}
      {items && !shown.length && <p className="px-2 py-10 text-center text-sm text-muted">Nothing has been shared with you yet.</p>}
      {shown.map((i) => {
        const Icon = i.type === "doc" ? FileText : Folder;
        const row = (
          <>
            <Icon className="size-4 shrink-0 text-muted" />
            <span className="flex-1 truncate text-[14px]">{i.title || (i.type === "doc" ? "Untitled" : "Untitled folder")}</span>
            <span className="shrink-0 text-[12px] text-muted">
              {i.ownerName} · {ROLE[i.role]}
            </span>
          </>
        );
        const rowClass = "flex items-center gap-3 border-b border-line px-2 py-3 dark:border-white/10";
        return i.type === "doc" ? (
          <Link key={i.id} to={`/doc/${i.id}`} className={`${rowClass} hover:bg-hover dark:hover:bg-white/5`}>
            {row}
          </Link>
        ) : (
          <div key={i.id} className={rowClass}>
            {row}
          </div>
        );
      })}
    </div>
  );
}
