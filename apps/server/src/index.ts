import { app } from "./app";
import { config } from "./config";
import { attachCollab, hocuspocus } from "./collab/hocuspocus";
import { scheduleJobs } from "./purge";

const server = app.listen(config.PORT, () => {
  console.log(`SyncScribe server on http://localhost:${config.PORT} (sync at ws://localhost:${config.PORT}/collab)`);
});
attachCollab(server);
scheduleJobs();

// Save any pending document changes before the process exits
const shutdown = () => {
  hocuspocus.flushPendingStores();
  setTimeout(() => process.exit(0), 200);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
