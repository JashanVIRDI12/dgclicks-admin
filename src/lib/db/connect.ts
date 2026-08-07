import "server-only";

import mongoose, { type Connection } from "mongoose";

import { mongoClient } from "@/lib/db/client";
import { env } from "@/lib/env";

/**
 * The Mongoose connection every model registers against.
 *
 * Created unopened at module load so model files can call `db.model(...)` at
 * import time, then adopted onto the shared MongoClient by
 * `connectToDatabase()`. Mongoose buffers commands issued before the client is
 * connected, but callers should still await `connectToDatabase()` so failures
 * surface as errors rather than hanging requests.
 */
const globalForDb = globalThis as unknown as {
  __mongooseConnection?: Connection;
  __mongooseConnectPromise?: Promise<Connection>;
};

export const db: Connection =
  globalForDb.__mongooseConnection ?? mongoose.createConnection();

if (!env.isProduction) {
  globalForDb.__mongooseConnection = db;
}

async function adoptSharedClient(): Promise<Connection> {
  await mongoClient.connect();

  // `setClient` throws if the connection is already open, which happens when
  // two requests race through here on a cold start.
  if (db.readyState === mongoose.ConnectionStates.disconnected) {
    db.setClient(mongoClient);
  }

  return db;
}

/**
 * Idempotent. Call at the top of any server action, route handler or server
 * component that touches a Mongoose model.
 *
 * The in-flight promise is cached so concurrent callers on a cold start share
 * one connection attempt instead of racing to call `setClient` twice.
 */
export function connectToDatabase(): Promise<Connection> {
  if (db.readyState === mongoose.ConnectionStates.connected) {
    return Promise.resolve(db);
  }

  globalForDb.__mongooseConnectPromise ??= adoptSharedClient().catch(
    (error: unknown) => {
      // Clear the cache so the next request retries instead of replaying a
      // rejected promise forever.
      globalForDb.__mongooseConnectPromise = undefined;
      throw error;
    },
  );

  return globalForDb.__mongooseConnectPromise;
}

/** True when the Mongoose connection is live. Used by the health check. */
export function isDatabaseConnected(): boolean {
  return db.readyState === mongoose.ConnectionStates.connected;
}
