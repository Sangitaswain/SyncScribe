import type { onAuthenticatePayload } from "@hocuspocus/server";
import { verifyToken, type TokenUser } from "../auth/jwt";
import { roleFor } from "../permissions/resolve";
import type { Role } from "@syncscribe/shared";

export interface CollabContext {
  user: TokenUser;
  role: Role;
}

/** Rejects a sync connection; the client receives `reason` (FP-10.2). */
export const deny = (reason: string) => Object.assign(new Error(reason), { reason });

/** Who can open a doc and whether their edits are accepted (BP-6.2). */
export async function onAuthenticate({ token, documentName, connectionConfig }: onAuthenticatePayload): Promise<CollabContext> {
  let user: TokenUser;
  try {
    user = await verifyToken(token);
  } catch (e) {
    throw deny((e as Error).message); // "token-expired" | "invalid-token"
  }
  const role = roleFor(user.id, documentName);
  if (role === null) throw deny("unknown-doc"); // client retries after its workspace tree has synced
  if (role === "none") throw deny("forbidden");

  // Read-only connections receive updates but the server ignores anything they send (G5, EC18)
  const kind = documentName.split(":")[0];
  if ((kind === "doc" || kind === "ws") && (role === "viewer" || role === "commenter")) connectionConfig.readOnly = true;
  if (kind === "cm" && role === "viewer") connectionConfig.readOnly = true;
  return { user, role };
}
