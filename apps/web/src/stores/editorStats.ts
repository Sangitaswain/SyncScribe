import { create } from "zustand";

/** Word count of the open document for the status bar; null when no document is open. */
export const useEditorStats = create<{ words: number | null }>(() => ({ words: null }));
