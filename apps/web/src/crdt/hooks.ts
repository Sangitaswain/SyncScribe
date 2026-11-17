import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type * as Y from "yjs";
import { getDoc, releaseDoc } from "./registry";

/** Opens a Y.Doc for the lifetime of the component (null while loading from the device). */
export function useDoc(name: string | undefined) {
  const [doc, setDoc] = useState<Y.Doc | null>(null);
  useEffect(() => {
    if (!name) return;
    let live = true;
    getDoc(name).then((d) => live && setDoc(d));
    return () => {
      live = false;
      setDoc(null);
      releaseDoc(name);
    };
  }, [name]);
  return doc;
}

/** Plain-JSON snapshot of a Yjs map/array/text that updates on every (deep) change. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useY<T = unknown>(type: Y.AbstractType<any> | undefined): T | undefined {
  const snap = useRef<{ type?: unknown; value?: T }>({});
  // Stable per type, so React subscribes once instead of on every render
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (!type) return () => {};
      const handler = () => {
        snap.current = { type, value: type.toJSON() as T };
        onChange();
      };
      type.observeDeep(handler);
      // A change can land between the first render and this subscription (e.g. the server's copy
      // arriving); re-read now so React sees it instead of keeping the stale first snapshot
      snap.current = { type, value: type.toJSON() as T };
      return () => type.unobserveDeep(handler);
    },
    [type],
  );
  return useSyncExternalStore(subscribe, () => {
    if (snap.current.type !== type) snap.current = { type, value: type?.toJSON() as T | undefined };
    return snap.current.value;
  });
}
