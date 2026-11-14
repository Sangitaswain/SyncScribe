import { Router } from "express";
import { profileSchema } from "@syncscribe/shared";
import { db } from "../db/db";
import { HttpError } from "../errors";
import { currentUser, requireAuth } from "../auth/middleware";
import { authResponse, userById } from "../users";

export const meRouter = Router();
meRouter.use(requireAuth);

const me = (id: string) => {
  const user = userById(id);
  if (!user) throw new HttpError(401, "unauthenticated", "Please sign in");
  return user;
};

meRouter.get("/", async (_req, res) => {
  res.json(await authResponse(me(currentUser(res).id)));
});

// Name and colour are inside the token, so a new token is returned too
meRouter.patch("/", async (req, res) => {
  const { name, color } = profileSchema.parse(req.body);
  const id = currentUser(res).id;
  db.prepare("UPDATE users SET name = COALESCE(?, name), color = COALESCE(?, color) WHERE id = ?").run(
    name ?? null, color ?? null, id,
  );
  res.json(await authResponse(me(id)));
});
