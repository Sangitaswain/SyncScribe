// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { act, renderHook, waitFor } from "@testing-library/react";
import { expect, it } from "vitest";
import * as Y from "yjs";
import { useDoc, useY } from "./hooks";
import { peekDoc } from "./registry";

it("re-renders on Yjs changes", () => {
  const doc = new Y.Doc();
  const map = doc.getMap<string>("m");
  const { result } = renderHook(() => useY<Record<string, string>>(map));
  expect(result.current).toEqual({});
  act(() => map.set("title", "Hello"));
  expect(result.current).toEqual({ title: "Hello" });

  const text = doc.getText("t");
  const t = renderHook(() => useY<string>(text));
  act(() => text.insert(0, "abc"));
  expect(t.result.current).toBe("abc");
});

it("opens and releases a doc with the component", async () => {
  const { result, unmount } = renderHook(() => useDoc("doc:hook"));
  await waitFor(() => expect(result.current).toBeInstanceOf(Y.Doc));
  unmount();
  expect(peekDoc("doc:hook")).toBeUndefined();
});
