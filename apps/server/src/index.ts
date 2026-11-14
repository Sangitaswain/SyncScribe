import express from "express";
import helmet from "helmet";
import cors from "cors";
import { config } from "./config";
import "./db/db";
import { errorHandler, notFound } from "./errors";

export const app = express();
app.use(helmet());
app.use(cors({ origin: config.APP_URL }));
app.use(express.json({ limit: "1mb" }));

app.use(notFound);
app.use(errorHandler);

app.listen(config.PORT, () => {
  console.log(`SyncScribe server on http://localhost:${config.PORT}`);
});
