import { useEffect } from "react";
import { useParams } from "react-router";
import { addRecent, usePrefs } from "../crdt/prefs";

/** Document screen. The editor arrives in Step 9; for now it records the visit in Recents (B9). */
export default function DocPage() {
  const { docId } = useParams();
  const { doc: prefs } = usePrefs();
  useEffect(() => {
    if (prefs && docId) addRecent(prefs, docId);
  }, [prefs, docId]);
  return (
    <div className="p-8">
      <h1 className="text-xl font-semibold">Document</h1>
      <p className="mt-2 text-sm text-slate-500">{docId}</p>
    </div>
  );
}
