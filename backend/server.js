import { createApp } from "./src/app.js";
import { env } from "./src/config.js";
import { closeDb } from "./src/db/index.js";

const app = createApp();

const server = app.listen(env.port, () => {
  console.log(`HotelStay API → http://localhost:${env.port}`);
});

async function shutdown(signal) {
  console.log(`\n${signal} received, shutting down...`);
  server.close(async () => {
    await closeDb();
    process.exit(0);
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
