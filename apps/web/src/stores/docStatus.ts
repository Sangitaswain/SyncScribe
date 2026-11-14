import { create } from "zustand";
import type { Role } from "@syncscribe/shared";

export interface DocStatus {
  pending: boolean;
  synced: boolean;
  role: Role;
  revoked: boolean;
  offlineAvailable: boolean;
}

/** Per-document status, keyed by doc name ("doc:abc"). */
export const useDocStatus = create<Record<string, DocStatus>>(() => ({}));

const DEFAULT: DocStatus = { pending: false, synced: false, role: "owner", revoked: false, offlineAvailable: false };

export const setDocStatus = (name: string, patch: Partial<DocStatus>) =>
  useDocStatus.setState((s) => ({ [name]: { ...DEFAULT, ...s[name], ...patch } }));
