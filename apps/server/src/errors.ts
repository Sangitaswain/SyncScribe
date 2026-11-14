import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export const notFound: RequestHandler = () => {
  throw new HttpError(404, "not_found", "Not found");
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message } });
  } else if (err instanceof ZodError) {
    res.status(400).json({ error: { code: "invalid_input", message: err.issues[0]?.message ?? "Invalid input" } });
  } else if (err?.status >= 400 && err.status < 500) {
    // e.g. malformed JSON or oversized body from express.json()
    res.status(err.status).json({ error: { code: "bad_request", message: "The request could not be read" } });
  } else {
    console.error(err);
    res.status(500).json({ error: { code: "server_error", message: "Something went wrong on the server" } });
  }
};
