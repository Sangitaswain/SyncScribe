import { SignJWT, jwtVerify } from "jose";
import { config } from "../config";

const key = new TextEncoder().encode(config.JWT_SECRET);

export interface TokenUser {
  id: string;
  name: string;
  color: string;
}

// 7 days: long enough for offline periods; clients refresh on reconnect (BP-4.1)
export const signToken = (user: TokenUser, expiresIn = "7d") =>
  new SignJWT({ name: user.name, color: user.color })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(key);

/** Throws "token-expired" or "invalid-token" (the sync server forwards these reasons to the client). */
export const verifyToken = async (token: string): Promise<TokenUser> => {
  try {
    const { payload } = await jwtVerify(token, key);
    return { id: payload.sub!, name: String(payload.name), color: String(payload.color) };
  } catch (e) {
    throw new Error((e as { code?: string }).code === "ERR_JWT_EXPIRED" ? "token-expired" : "invalid-token", { cause: e });
  }
};
