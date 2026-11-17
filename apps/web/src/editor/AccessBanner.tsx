import { useNavigate } from "react-router";
import type * as Y from "yjs";
import { DOC, docDoc, rank } from "@syncscribe/shared";
import { useDocStatus, setDocStatus } from "../stores/docStatus";
import { deleteLocal } from "../crdt/registry";
import { revokedSet } from "../services/docSets";
import { downloadText } from "../lib/download";

const action = "font-medium text-brand hover:underline";

/** Read-only notice (G5, EC17) and "access removed" notice with an export of the local copy (EC16). */
export default function AccessBanner({ docId, doc }: { docId: string; doc: Y.Doc }) {
  const name = docDoc(docId);
  const status = useDocStatus((s) => s[name]);
  const navigate = useNavigate();
  if (!status) return null;

  const exportCopy = () => {
    const title = String(doc.getMap(DOC.meta).get("title") || "Untitled");
    downloadText(`${title}.md`, doc.getText(DOC.content).toString());
  };
  const remove = async () => {
    navigate("/");
    await deleteLocal(name);
    await revokedSet.remove(name);
  };

  let text: string;
  let buttons: { label: string; onClick: () => void }[] = [];
  if (status.revoked) {
    text = "Your access to this document was removed. Changes you made since then were not saved to the server.";
    buttons = [
      { label: "Export my local copy", onClick: exportCopy },
      { label: "Remove from this device", onClick: remove },
    ];
  } else if (rank(status.role) < rank("editor")) {
    text = "You can view this document but not edit it.";
    if (status.rejectedEdits) {
      text += " Changes you made offline after your access changed were not accepted.";
      buttons = [
        { label: "Export my local copy", onClick: exportCopy },
        { label: "Dismiss", onClick: () => setDocStatus(name, { rejectedEdits: false }) },
      ];
    }
  } else return null;

  return (
    <div role="status" className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 bg-panel px-4 py-1.5 text-xs text-muted dark:bg-white/5">
      <span className="min-w-0 flex-1">{text}</span>
      {buttons.map((b) => (
        <button key={b.label} onClick={b.onClick} className={action}>
          {b.label}
        </button>
      ))}
    </div>
  );
}
