import { createApplication } from "./app.js";
import { startScheduler } from "./scheduler.js";
import { disconnectDatabase } from "./server/db/pool.js";

const app = await createApplication();
const stopScheduler = startScheduler();
await app.listen(Number(process.env.PORT ?? 3001), process.env.HOSTNAME ?? "127.0.0.1");
let stopping = false;
async function stop(): Promise<void> {
  if (stopping) return;
  stopping = true;
  stopScheduler();
  await app.close();
  await disconnectDatabase();
}
process.once("SIGTERM", () => { void stop(); });
process.once("SIGINT", () => { void stop(); });
