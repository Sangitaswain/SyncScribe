import express from "express";
import helmet from "helmet";
import cors from "cors";
import { config } from "./config";
import "./db/db";
import { errorHandler, notFound } from "./errors";
import { authRouter } from "./routes/auth";
import { meRouter } from "./routes/me";
import { syncRouter } from "./routes/sync";

export const app = express();
app.use(helmet());
// The app's URL, plus any localhost port in development (Vite may pick 5174, preview uses 4173)
const localhost = /^http:\/\/(localhost|127\.0\.0\.1):\d+$/;
app.use(cors({ origin: (origin, ok) => ok(null, !origin || origin === config.APP_URL || localhost.test(origin)) }));
app.use(express.json({ limit: "1mb" }));

// Used by the client's Network Monitor to tell "online" from "server unreachable" (BP-5.8)
app.get("/api/health", (_req, res) => {
  res.json({ ok: true, time: Date.now() });
});

app.use("/api/auth", authRouter);
app.use("/api/me", meRouter);
app.use("/api/sync", syncRouter);

app.use(notFound);
app.use(errorHandler);
