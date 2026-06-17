import { createApp } from "./app.js";
import { connectDb, disconnectDb } from "./config/db.js";
import { env } from "./config/env.js";

async function main() {
  await connectDb();

  const app = createApp();
  const server = app.listen(env.port, () => {
    console.log(`[server] backend listening on http://localhost:${env.port}`);
  });

  const shutdown = async (signal: string) => {
    console.log(`\n[server] ${signal} received, shutting down...`);
    server.close();
    await disconnectDb();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((err) => {
  console.error("[fatal] failed to start backend", err);
  process.exit(1);
});
