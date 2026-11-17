import { Router } from "express";
import { createHash, randomBytes } from "node:crypto";
import rateLimit from "express-rate-limit";
import { nanoid } from "nanoid";
import { COLORS, forgotSchema, loginSchema, resetSchema, signupSchema } from "@syncscribe/shared";
import { config } from "../config";
import { sendMail } from "../mail/mailer";
import { db } from "../db/db";
import { HttpError } from "../errors";
import { hashPassword, verifyPassword } from "../auth/password";
import { seedWorkspace } from "../collab/seed";
import { authResponse, userByEmail, userById } from "../users";
import { currentUser, requireAuth } from "../auth/middleware";

export const authRouter = Router();
const limiter = rateLimit({ windowMs: 60_000, limit: config.AUTH_RATE_LIMIT });

authRouter.post("/signup", limiter, async (req, res) => {
  const { name, email, password } = signupSchema.parse(req.body);
  if (userByEmail(email)) throw new HttpError(409, "email_taken", "An account with this email already exists");

  const userId = nanoid();
  const workspaceId = nanoid();
  const now = Date.now();
  const color = COLORS[Math.floor(Math.random() * COLORS.length)];
  const passwordHash = await hashPassword(password);
  const wsName = `${name}'s workspace`;

  db.transaction(() => {
    db.prepare(
      "INSERT INTO users (id, email, name, password_hash, color, personal_workspace_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ).run(userId, email, name, passwordHash, color, workspaceId, now);
    db.prepare("INSERT INTO workspaces (id, name, kind, owner_id, created_at) VALUES (?, ?, 'personal', ?, ?)").run(
      workspaceId, wsName, userId, now,
    );
    db.prepare("INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (?, ?, 'owner')").run(workspaceId, userId);
    seedWorkspace({ workspaceId, userId, name: wsName, kind: "personal" });
    // Documents shared with this email before the account existed (EC22)
    db.prepare("UPDATE shares SET user_id = ?, invited_email = NULL WHERE invited_email = ?").run(userId, email);
  })();

  res.status(201).json(await authResponse(userById(userId)!));
});

authRouter.post("/login", limiter, async (req, res) => {
  const { email, password } = loginSchema.parse(req.body);
  const user = userByEmail(email);
  if (!user || !(await verifyPassword(password, user.password_hash)))
    throw new HttpError(401, "bad_credentials", "Email or password is incorrect");
  res.json(await authResponse(user));
});

// Issues a fresh token while the current one is still valid (BP-4.1)
authRouter.post("/refresh", requireAuth, async (_req, res) => {
  const user = userById(currentUser(res).id);
  if (!user) throw new HttpError(401, "unauthenticated", "Please sign in");
  res.json(await authResponse(user));
});

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

// Always 200 so the response never reveals whether an account exists (BP-8)
authRouter.post("/forgot", limiter, async (req, res) => {
  const { email } = forgotSchema.parse(req.body);
  const user = userByEmail(email);
  if (user) {
    const token = randomBytes(32).toString("hex");
    db.prepare("INSERT INTO password_resets (token_hash, user_id, expires_at) VALUES (?, ?, ?)").run(
      sha256(token), user.id, Date.now() + 60 * 60 * 1000,
    );
    await sendMail({
      to: user.email,
      subject: "Reset your SyncScribe password",
      text: `Open this link within 1 hour to choose a new password:\n${config.APP_URL}/reset/${token}`,
    });
  }
  res.json({ ok: true });
});

authRouter.post("/reset", limiter, async (req, res) => {
  const { token, password } = resetSchema.parse(req.body);
  const row = db
    .prepare("SELECT user_id FROM password_resets WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?")
    .get(sha256(token), Date.now()) as { user_id: string } | undefined;
  if (!row) throw new HttpError(400, "reset_invalid", "This reset link is invalid or has expired");
  const hash = await hashPassword(password);
  db.transaction(() => {
    db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hash, row.user_id);
    db.prepare("UPDATE password_resets SET used_at = ? WHERE token_hash = ?").run(Date.now(), sha256(token));
  })();
  res.json({ ok: true });
});
