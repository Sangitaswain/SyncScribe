import { useEffect, useRef, useState, useSyncExternalStore } from "react";
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
  return useSyncExternalStore(
    (onChange) => {
      if (!type) return () => {};
      const handler = () => {
        snap.current = { type, value: type.toJSON() as T };
        onChange();
      };
      type.observeDeep(handler);
      return () => type.unobserveDeep(handler);
    },
    () => {
      if (snap.current.type !== type)
        snap.current = { type, value: type?.toJSON() as T | undefined };
      return snap.current.value;
    },
  );
}
