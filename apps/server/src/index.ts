import express from "express";
import { config } from "./config";
import "./db/db";

export const app = express();

app.listen(config.PORT, () => {
  console.log(`SyncScribe server on http://localhost:${config.PORT}`);
});
