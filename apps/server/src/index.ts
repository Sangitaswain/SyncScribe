import express from "express";
import { config } from "./config";

export const app = express();

app.listen(config.PORT, () => {
  console.log(`SyncScribe server on http://localhost:${config.PORT}`);
});
