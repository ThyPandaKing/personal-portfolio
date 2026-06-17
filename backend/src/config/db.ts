import mongoose from "mongoose";
import { env } from "./env.js";

/** Mask credentials in a connection string for safe logging. */
function maskUri(uri: string): string {
  return uri.replace(/\/\/([^:]+):[^@]+@/, "//$1:****@");
}

/**
 * Connect to MongoDB Atlas (or any MongoDB) via Mongoose.
 * The `mongodb+srv://` Atlas connection string is supported out of the box.
 */
export async function connectDb(): Promise<void> {
  mongoose.set("strictQuery", true);

  mongoose.connection.on("error", (err) => {
    console.error("[db] connection error:", err.message);
  });
  mongoose.connection.on("disconnected", () => {
    // Transient on Atlas; the driver reconnects automatically.
    console.warn("[db] disconnected — driver will attempt to reconnect");
  });
  mongoose.connection.on("reconnected", () => {
    console.log("[db] reconnected");
  });

  await mongoose.connect(env.mongoUri, {
    // The database name is set explicitly here, so it does NOT depend on the
    // path in the Atlas connection string.
    dbName: env.mongoDb,
    // Atlas-friendly resilience defaults
    serverSelectionTimeoutMS: 10_000,
    socketTimeoutMS: 45_000,
    heartbeatFrequencyMS: 10_000,
    maxPoolSize: 10,
    retryWrites: true,
    retryReads: true,
    appName: "portfolio-backend",
  });

  console.log(`[db] connected to ${maskUri(env.mongoUri)} (db: ${env.mongoDb})`);
}

export async function disconnectDb(): Promise<void> {
  await mongoose.disconnect();
}
