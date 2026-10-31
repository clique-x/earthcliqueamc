import { sqlClient } from "@amc/db";
import { buildApp } from "./app";
import { env } from "./env";
import { closeEvents, startEventSubscriber } from "./lib/events";
import { dispatchQueue, startDispatchWorker } from "./services/dispatch";
import { rfqQueue, startRfqWorker } from "./services/rfq";

const app = await buildApp();
await startEventSubscriber();
const worker = startDispatchWorker();
const rfqWorker = startRfqWorker();

await app.listen({ port: env.API_PORT, host: "0.0.0.0" });

async function shutdown() {
  app.log.info("Shutting down");
  await app.close();
  await worker.close();
  await rfqWorker.close();
  await dispatchQueue.close();
  await rfqQueue.close();
  await closeEvents();
  await sqlClient.end();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
