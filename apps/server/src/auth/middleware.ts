import type { RequestHandler, Response } from "express";
import { HttpError } from "../errors";
import { verifyToken, type TokenUser } from "./jwt";

export const requireAuth: RequestHandler = async (req, res, next) => {
  const token = req.headers.authorization?.replace(/^Bearer /, "");
  if (!token) throw new HttpError(401, "unauthenticated", "Please sign in");
  try {
    res.locals.user = await verifyToken(token);
  } catch (e) {
    throw new HttpError(401, (e as Error).message, "Your session has expired. Please sign in again.");
  }
  next();
};

export const currentUser = (res: Response) => res.locals.user as TokenUser;
