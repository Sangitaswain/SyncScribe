import { create } from "zustand";
import type { Role } from "@syncscribe/shared";

export interface DocStatus {
  pending: boolean;
  synced: boolean;
  role: Role;
  revoked: boolean;
  offlineAvailable: boolean;
  /** Offline edits the server refused because the doc became read-only (EC17); not saved anywhere else */
  rejectedEdits: boolean;
  /** Can add comments: owners, editors and commenters (from the comments connection's scope) */
  canComment: boolean;
}

/** Per-document status, keyed by doc name ("doc:abc"). */
export const useDocStatus = create<Record<string, DocStatus>>(() => ({}));

const DEFAULT: DocStatus = { pending: false, synced: false, role: "owner", revoked: false, offlineAvailable: false, rejectedEdits: false, canComment: true };

export const setDocStatus = (name: string, patch: Partial<DocStatus>) =>
  useDocStatus.setState((s) => ({ [name]: { ...DEFAULT, ...s[name], ...patch } }));
