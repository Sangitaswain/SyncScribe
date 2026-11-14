import express from "express";
import helmet from "helmet";
import cors from "cors";
import { config } from "./config";
import "./db/db";
import { errorHandler, notFound } from "./errors";
import { authRouter } from "./routes/auth";

export const app = express();
app.use(helmet());
app.use(cors({ origin: config.APP_URL }));
app.use(express.json({ limit: "1mb" }));

// Used by the client's Network Monitor to tell "online" from "server unreachable" (BP-5.8)
app.get("/api/health", (_req, res) => {
  res.json({ ok: true, time: Date.now() });
});

app.use("/api/auth", authRouter);

app.use(notFound);
app.use(errorHandler);
