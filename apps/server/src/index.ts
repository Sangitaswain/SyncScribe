import { app } from "./app";
import { config } from "./config";

app.listen(config.PORT, () => {
  console.log(`SyncScribe server on http://localhost:${config.PORT}`);
});
