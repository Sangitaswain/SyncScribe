// Response shapes shared by the web client and the server.
import type { Role, ShareRole } from "./roles";

export interface User {
  id: string;
  email: string;
  name: string;
  color: string;
  personalWorkspaceId: string;
}

export interface Workspace {
  id: string;
  name: string;
  kind: "personal" | "team";
  role: Role;
}

export interface AuthResponse {
  user: User;
  token: string;
  workspaces: Workspace[];
}

export interface Share {
  id: string;
  resourceId: string;
  userId: string | null;
  email: string;
  name: string | null;
  role: ShareRole;
}

export interface ShareLink {
  id: string;
  resourceId: string;
  role: ShareRole;
  url: string;
  revoked: boolean;
}

export interface SharedItem {
  id: string;
  type: "doc" | "folder";
  title: string;
  role: ShareRole;
  ownerName: string;
}

export interface Version {
  id: string;
  docId: string;
  name: string | null;
  authors: string[];
  createdAt: number;
}

export type NotificationType = "shared" | "mentioned" | "access_removed" | "role_changed";

export interface AppNotification {
  id: string;
  type: NotificationType;
  payload: Record<string, unknown>;
  readAt: number | null;
  createdAt: number;
}

export interface ApiError {
  error: { code: string; message: string };
}
