import { Router } from "express";
import rateLimit from "express-rate-limit";
import { nanoid } from "nanoid";
import { loginSchema, signupSchema } from "@syncscribe/shared";
import { db } from "../db/db";
import { HttpError } from "../errors";
import { hashPassword, verifyPassword } from "../auth/password";
import { seedWorkspace } from "../collab/seed";
import { COLORS, authResponse, userByEmail, userById } from "../users";
import { currentUser, requireAuth } from "../auth/middleware";

export const authRouter = Router();
const limiter = rateLimit({ windowMs: 60_000, limit: 10 });

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
