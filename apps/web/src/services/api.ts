import type { ApiError as ApiErrorBody } from "@syncscribe/shared";
import { useSession } from "../stores/session";

export const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

/** Typed JSON request to the SyncScribe API. Network failures become code "offline". */
export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const token = useSession.getState().token;
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api${path}`, {
      method: init.method ?? (init.body ? "POST" : "GET"),
      headers: {
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: init.body ? JSON.stringify(init.body) : undefined,
    });
  } catch {
    throw new ApiError(0, "offline", "Can't reach SyncScribe. Check your connection.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = (data as ApiErrorBody).error ?? { code: "server_error", message: "Something went wrong" };
    // An expired session while signed in: keep local data, ask to sign in again (EC19)
    if (res.status === 401 && token) useSession.setState({ status: "needsReauth" });
    throw new ApiError(res.status, err.code, err.message);
  }
  return data as T;
}
